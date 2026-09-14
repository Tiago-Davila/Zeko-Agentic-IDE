import contextlib
from dataclasses import replace
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import task_to_issues as importer


PROFILES = "\n".join(f"| {p} | Check {p} |" for p in ["DOC", "BE", "BEI", "BEC", "FE", "E2E", "ALL"])


def block(task_id="T001", deps="ninguna", tags="", files="`docs/área con espacios.md`", checks="DOC"):
    return f"""- [ ] {task_id} {tags}Título con `literal`, acentos y comillas — {files}.

  **Dependencias**: {deps}. **Traza**: FR-001; plan §Diseño. **Checks**: {checks}.

  **Aceptación**: Conservar texto, comillas " y `backticks`.
  Una segunda línea con T099 es descripción, no dependencia.

"""


def document(*blocks, heading="## Fase 0 - Documentación"):
    return f"# Tasks\n\n{PROFILES}\n\n{heading}\n\n" + "".join(blocks)


class ParserTests(unittest.TestCase):
    def parse(self, *blocks, **kwargs):
        return importer.parse_document(document(*blocks, **kwargs))[0]

    def test_full_task_body_unicode_and_multiline(self):
        task = self.parse(block())[0]
        self.assertEqual(task.files, ["docs/área con espacios.md"])
        self.assertIn("segunda línea", task.acceptance)
        self.assertIn("T099", task.acceptance)
        self.assertEqual(task.dependencies, [])

    def test_crlf_and_bom(self):
        tasks, _ = importer.parse_document("\ufeff" + document(block()).replace("\n", "\r\n"))
        self.assertEqual(tasks[0].id, "T001")

    def test_parallel_story_and_completed(self):
        tasks = self.parse(block(tags="[P] [US1] ").replace("[ ]", "[X]", 1), heading="## Fase 3 - US-001: proyecto (P1)")
        self.assertTrue(tasks[0].completed)
        self.assertTrue(tasks[0].parallel)
        self.assertEqual(tasks[0].priority, "P1")

    def test_phase_10_not_phase_1(self):
        task = self.parse(block(), heading="## Fase 10 — Integración")[0]
        self.assertEqual(task.phase, 10)

    def test_fenced_example_and_table_are_not_issues(self):
        text = document(block()) + "## Ejemplos\n```text\n" + block("T999") + "```\n| T777 | muestra |\n"
        tasks, _ = importer.parse_document(text)
        self.assertEqual([t.id for t in tasks], ["T001"])
        self.assertNotIn("Ejemplos", tasks[0].acceptance)

    def test_inline_task_reference_does_not_create_issue(self):
        self.assertEqual(len(self.parse(block())), 1)

    def test_duplicate_id_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicados"):
            self.parse(block(), block())

    def test_missing_field_rejected(self):
        with self.assertRaisesRegex(ValueError, "faltan campos"):
            self.parse(block().replace("**Checks**", "Checks"))

    def test_malformed_task_not_silently_skipped(self):
        with self.assertRaisesRegex(ValueError, "mal formada"):
            self.parse(block().replace("T001", "T01", 1))

    def test_outside_phase_rejected(self):
        with self.assertRaisesRegex(ValueError, "fuera de una fase"):
            importer.parse_document(PROFILES + "\n" + block())

    def test_bad_dependencies_rejected(self):
        with self.assertRaisesRegex(ValueError, "dependencias inválidas"):
            self.parse(block(deps="T002 y T003"))

    def test_missing_dependency_rejected(self):
        with self.assertRaisesRegex(ValueError, "inexistentes"):
            self.parse(block(deps="T099"))

    def test_cycles_and_self_dependencies_rejected(self):
        with self.assertRaisesRegex(ValueError, "Ciclo"):
            self.parse(block(deps="T002"), block("T002", deps="T001"))
        with self.assertRaisesRegex(ValueError, "Ciclo"):
            self.parse(block(deps="T001"))

    def test_forward_dependency_sorted_for_publication(self):
        tasks = self.parse(block(deps="T002"), block("T002"))
        self.assertEqual([t.id for t in importer.topological(tasks)], ["T002", "T001"])

    def test_invalid_file_list_rejected(self):
        with self.assertRaisesRegex(ValueError, "lista de archivos"):
            self.parse(block(files="docs/a.md"))
        with self.assertRaisesRegex(ValueError, "fuera del repo"):
            self.parse(block(files="`../outside.md`"))

    def test_duplicate_field_rejected(self):
        with self.assertRaisesRegex(ValueError, "campo duplicado"):
            self.parse(block() + "**Checks**: DOC.\n")

    def test_story_phase_mismatch_rejected(self):
        with self.assertRaisesRegex(ValueError, "historia no coincide"):
            self.parse(block(tags="[US2] "), heading="## Fase 3 - US-001: proyecto (P1)")

    def test_unclosed_fence_rejected(self):
        with self.assertRaisesRegex(ValueError, "sin cerrar"):
            importer.parse_document(document(block()) + "```\n")

    def test_missing_profile_definition_rejected(self):
        with self.assertRaisesRegex(ValueError, "definiciones de checks"):
            importer.parse_document(document(block()).replace("| DOC | Check DOC |", ""))


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tasks, self.profiles = importer.parse_document(document(block(), block("T002", "T001")))

    def test_body_preserves_text_and_links_dependencies(self):
        body = importer.issue_body(self.tasks[1], "001-zeko-mvp", "owner/repo", "specs/001-zeko-mvp/tasks.md", "feature/001-zeko-mvp", self.profiles, {"T001": 42})
        self.assertIn("T001 — #42", body)
        self.assertIn('comillas " y `backticks`', body)
        self.assertIn("feature%2F001-zeko-mvp", body)
        self.assertIn(importer.marker("001-zeko-mvp", "T002"), body)

    def test_exact_marker_prevents_task_id_substring_collision(self):
        existing = [{"number": 7, "title": "Other", "body": importer.marker("001-zeko-mvp", "T0010")}]
        self.assertEqual(importer.index_existing(existing, self.tasks, "001-zeko-mvp"), {})

    def test_skip_closed_or_open_existing_without_mutation(self):
        existing = [{"number": 7, "title": "Edited by user", "body": importer.marker("001-zeko-mvp", "T001"), "state": "closed"}]
        result = importer.index_existing(existing, self.tasks, "001-zeko-mvp")
        self.assertEqual(result["T001"]["number"], 7)

    def test_duplicate_markers_rejected(self):
        item = {"number": 7, "title": "Other", "body": importer.marker("001-zeko-mvp", "T001")}
        with self.assertRaisesRegex(ValueError, "varias issues"):
            importer.index_existing([item, {**item, "number": 8}], self.tasks, "001-zeko-mvp")

    def test_unmanaged_title_collision_rejected(self):
        item = {"number": 7, "title": importer.issue_title(self.tasks[0], "001-zeko-mvp"), "body": "Manual issue"}
        with self.assertRaisesRegex(ValueError, "sin marcador"):
            importer.index_existing([item], self.tasks, "001-zeko-mvp")

    def test_legacy_task_title_not_duplicated(self):
        item = {"number": 7, "title": "T001 Crear algo", "body": "Import anterior"}
        with self.assertRaisesRegex(ValueError, "sin marcador"):
            importer.index_existing([item], self.tasks, "001-zeko-mvp")

    def test_publication_body_file_and_idempotent_rerun_with_fake_gh(self):
        created = []
        definitions = importer.label_definitions(self.tasks, "001-zeko-mvp")
        with tempfile.TemporaryDirectory() as directory:
            args = SimpleNamespace(feature="001-zeko-mvp", repo="owner/repo", branch="feature/001-zeko-mvp", output=Path(directory))

            def fake_gh(*arguments):
                self.assertEqual(arguments[:2], ("issue", "create"))
                body = Path(arguments[arguments.index("--body-file") + 1]).read_text(encoding="utf-8")
                title = arguments[arguments.index("--title") + 1]
                number = len(created) + 41
                created.append({"title": title, "body": body, "number": number})
                return f"https://github.com/owner/repo/issues/{number}"

            with patch.object(importer, "run_gh", side_effect=fake_gh), contextlib.redirect_stdout(io.StringIO()):
                importer.publish(self.tasks, definitions, args, "specs/001-zeko-mvp/tasks.md", self.profiles, [], set(definitions))
            self.assertEqual(len(created), 2)
            self.assertIn("T001 — #41", created[1]["body"])
            self.assertIn('comillas " y `backticks`', created[0]["body"])
            with patch.object(importer, "run_gh", side_effect=AssertionError("No new writes on rerun")), contextlib.redirect_stdout(io.StringIO()):
                results = importer.publish(self.tasks, definitions, args, "specs/001-zeko-mvp/tasks.md", self.profiles, created, set(definitions))
            self.assertTrue(all(item["action"] == "skip-existing" for item in results))

    def test_paginated_remote_query_uses_json_lines(self):
        item = {"number": 9, "title": "Multiline", "body": "First\nSecond"}
        with patch.object(importer, "run_gh", side_effect=[json.dumps(item), "front\nbackend"]) as gh:
            issues, labels = importer.get_existing("owner/repo")
        self.assertEqual(issues[0]["body"], "First\nSecond")
        self.assertEqual(labels, {"front", "backend"})
        self.assertIn("--paginate", gh.call_args_list[0].args)
        self.assertTrue(gh.call_args_list[0].args[-1].endswith("@json"))

    def test_labels_by_paths_not_word_front_in_acceptance(self):
        task = replace(self.tasks[0], files=["frontend/src/features/approvals/ApprovalPrompt.tsx"], checks="FE")
        labels = importer.task_labels(task, "001-zeko-mvp")
        self.assertTrue({"front", "security", "testing", "ux", "fase:0"} <= set(labels))
        self.assertNotIn("backend", labels)

    def test_dry_run_makes_zero_gh_calls(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "tasks.md"
            source.write_text(document(block()), encoding="utf-8")
            with patch.object(importer, "run_gh", side_effect=AssertionError("No remote call allowed")), contextlib.redirect_stdout(io.StringIO()):
                result = importer.main(["--dry-run", "--repo", "owner/repo", "--tasks", str(source), "--output", str(root / "preview"), "--expect-count", "1"])
            self.assertEqual(result, 0)
            manifest = json.loads((root / "preview/issues.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest[0]["id"], "T001")

    def test_invalid_count_does_not_publish(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "tasks.md"
            source.write_text(document(block()), encoding="utf-8")
            with patch.object(importer, "run_gh", side_effect=AssertionError("No call")):
                with self.assertRaisesRegex(ValueError, "esperaban 92"):
                    importer.main(["--apply", "--repo", "owner/repo", "--tasks", str(source), "--expect-count", "92"])

    def test_gh_is_called_without_shell_interpolation(self):
        with patch.object(importer.subprocess, "run") as run:
            run.return_value.returncode = 0
            run.return_value.stdout = "ok"
            run.return_value.stderr = ""
            importer.run_gh("issue", "create", "--title", 'literal $(secret) `command` "text"')
            self.assertEqual(run.call_args.args[0][-1], 'literal $(secret) `command` "text"')
            self.assertNotIn("shell", run.call_args.kwargs)


if __name__ == "__main__":
    unittest.main()
