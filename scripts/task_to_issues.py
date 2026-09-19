#!/usr/bin/env python3
"""Parse Zeko's tasks.md strictly; preview offline or publish explicitly with gh."""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import asdict, dataclass
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
from urllib.parse import quote


TASK = re.compile(r"^- \[([ xX])\] (T\d{3,})(?: \[(P)\])?(?: \[(US\d+)\])?\s+(.+)$")
PHASE = re.compile(r"^## Fase (\d+)\s+[-–—]\s+(.+)$")
FIELD = re.compile(r"\*\*(Dependencias|Traza|Checks|Aceptación)\*\*\s*:\s*")
FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
CHECKBOX = re.compile(r"^\s*[-*+]\s*\[[^\]]*\]")
PROFILE = re.compile(r"^\|\s*(DOC|BE|BEI|BEC|FE|E2E|ALL)\s*\|\s*(.+?)\s*\|\s*$")
FEATURE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*")
REPO = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")


@dataclass
class Task:
    id: str
    phase: int
    phase_name: str
    story: str | None
    priority: str | None
    parallel: bool
    completed: bool
    title: str
    files: list[str]
    dependencies: list[str]
    trace: str
    checks: str
    acceptance: str
    source_line: int


def fail(message: str) -> None:
    raise ValueError(message)


def parse_task(header, lines, phase, phase_name, line_number) -> Task:
    state, task_id, parallel, story, description = header.groups()
    title, separator, file_text = description.rpartition(" — ")
    if not separator or not title.strip():
        fail(f"Línea {line_number}: {task_id} requiere título — `archivo`.")
    files = re.findall(r"`([^`]+)`", file_text)
    if not files or re.sub(r"`[^`]+`|[,.\s]", "", file_text):
        fail(f"{task_id}: lista de archivos inválida: {file_text}")
    for name in files:
        path = PurePosixPath(name)
        if (path.is_absolute() or ".." in path.parts or "\\" in name
                or re.search(r"[:*?<>|\r\n]", name) or "..." in name):
            fail(f"{task_id}: ruta no concreta o fuera del repo: {name}")
    if len(files) != len(set(files)):
        fail(f"{task_id}: archivos duplicados.")
    text = "\n".join(lines).strip()
    matches = list(FIELD.finditer(text))
    values = {}
    for index, match in enumerate(matches):
        key = match.group(1)
        if key in values:
            fail(f"{task_id}: campo duplicado {key}.")
        stop = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        value = text[match.end():stop].strip()
        if not value:
            fail(f"{task_id}: campo vacío {key}.")
        values[key] = value
    if set(values) != {"Dependencias", "Traza", "Checks", "Aceptación"}:
        fail(f"{task_id}: faltan campos de dependencias/traza/checks/aceptación.")
    if matches and text[:matches[0].start()].strip():
        fail(f"{task_id}: texto no reconocido antes de los metadatos.")
    dependency_text = values["Dependencias"].rstrip(".").strip()
    if dependency_text.casefold() == "ninguna":
        dependencies = []
    elif re.fullmatch(r"T\d{3,}(?:\s*,\s*T\d{3,})*", dependency_text):
        dependencies = re.findall(r"T\d{3,}", dependency_text)
    else:
        fail(f"{task_id}: dependencias inválidas: {dependency_text}")
    if len(set(dependencies)) != len(dependencies):
        fail(f"{task_id}: dependencias repetidas.")
    checks = values["Checks"].rstrip(".").strip()
    if checks not in {"DOC", "BE", "BEI", "BEC", "FE", "E2E", "ALL"}:
        fail(f"{task_id}: perfil desconocido: {checks}")
    expected_story = re.search(r"\bUS-(\d+)\b", phase_name)
    if expected_story and story != f"US{int(expected_story.group(1))}":
        fail(f"{task_id}: la historia no coincide con la fase {phase_name}.")
    if not expected_story and story:
        fail(f"{task_id}: etiqueta de historia fuera de una fase de historia.")
    priority = re.search(r"\((P[123])\)", phase_name)
    return Task(task_id, phase, phase_name, story,
                priority.group(1) if priority else None, bool(parallel), state.lower() == "x",
                title.strip(), files, dependencies, values["Traza"], checks,
                values["Aceptación"], line_number)


def parse_document(text: str) -> tuple[list[Task], dict[str, str]]:
    tasks, profiles = [], {}
    phase, phase_name, current = None, "", None
    lines, line_number, fence = [], 0, None

    def flush():
        nonlocal current, lines
        if current is not None:
            tasks.append(parse_task(current, lines, phase, phase_name, line_number))
        current, lines = None, []

    for number, raw in enumerate(text.lstrip("\ufeff").splitlines(), 1):
        line = raw.rstrip()
        fence_match = FENCE.match(line)
        if fence:
            if current is not None:
                lines.append(raw)
            if re.fullmatch(r"\s{0,3}" + re.escape(fence[0]) + "{" + str(fence[1]) + r",}\s*", line):
                fence = None
            continue
        if fence_match:
            token = fence_match.group(1)
            fence = (token[0], len(token))
            if current is not None:
                lines.append(raw)
            continue
        phase_match = PHASE.fullmatch(line)
        if phase_match:
            flush()
            phase, phase_name = int(phase_match.group(1)), phase_match.group(2)
            continue
        if re.match(r"^#{1,6}\s", line):
            flush()
            phase = None
            continue
        profile = PROFILE.fullmatch(line)
        if profile and phase is None:
            profiles[profile.group(1)] = profile.group(2)
        header = TASK.fullmatch(line)
        if header:
            if phase is None:
                fail(f"Línea {number}: tarea fuera de una fase válida.")
            flush()
            current, line_number = header, number
            continue
        if CHECKBOX.match(line) and (phase is not None or re.search(r"\bT\d+\b", line)):
            fail(f"Línea {number}: cabecera de tarea mal formada; no se omitió: {line}")
        if current is not None:
            lines.append(raw)
    if fence:
        fail("Bloque de código sin cerrar; puede ocultar tareas.")
    flush()
    if not tasks:
        fail("No se encontraron tareas válidas.")
    by_id = {task.id: task for task in tasks}
    if len(by_id) != len(tasks):
        fail("IDs de tarea duplicados.")
    for task in tasks:
        missing = set(task.dependencies) - set(by_id)
        if missing:
            fail(f"{task.id}: dependencias inexistentes: {sorted(missing)}")
    topological(tasks)
    required_profiles = {task.checks for task in tasks}
    if not required_profiles <= profiles.keys():
        fail(f"Faltan definiciones de checks: {sorted(required_profiles - profiles.keys())}")
    return tasks, profiles


def topological(tasks: list[Task]) -> list[Task]:
    pending = {task.id: task for task in tasks}
    ordered, done = [], set()
    while pending:
        ready = [t for t in pending.values() if set(t.dependencies) <= done]
        if not ready:
            fail(f"Ciclo de dependencias: {', '.join(pending)}")
        for task in ready:
            ordered.append(task)
            done.add(task.id)
            del pending[task.id]
    return ordered


BASE_LABELS = {
    "front": ("61DAFB", "Frontend React/TypeScript y sus pruebas"),
    "backend": ("007396", "Backend Java/Spring y sus pruebas"),
    "docs": ("0075CA", "Documentación, contratos o validación documental"),
    "security": ("B60205", "Permisos, aprobaciones, aislamiento o secretos"),
    "testing": ("1D76DB", "Pruebas automatizadas o verificación explícita"),
    "database": ("D4C5F9", "SQLite, repositorios de datos o migraciones"),
    "runtime": ("5319E7", "Ejecución, proveedores y observabilidad"),
    "git": ("F05032", "Repositorios, worktrees y commits"),
    "rag": ("0E8A16", "Memoria, fuentes e índice Lucene"),
    "ux": ("E99695", "Interacción y estados de interfaz"),
    "build": ("C5DEF5", "Build, dependencias, empaquetado y checks"),
    "parallel": ("BFDADC", "Paralelismo condicionado a dependencias y archivos"),
    "sdd:documentation": ("0052CC", "Fase documental; no ejecutar mediante implement"),
    "source:completed": ("6F42C1", "Marcada completada en tasks.md; no cierra la issue"),
}


def task_labels(task: Task, feature: str) -> list[str]:
    labels = {f"feature:{feature}", f"fase:{task.phase}"}
    files = " ".join(task.files).lower()
    title = task.title.casefold()
    if any(p.startswith("frontend/") for p in task.files):
        labels.add("front")
    if any(p.startswith("backend/") for p in task.files):
        labels.add("backend")
    if task.checks == "DOC" or any(p.endswith(".md") or "/contracts/" in p for p in task.files):
        labels.add("docs")
    if task.phase == 0:
        labels.add("sdd:documentation")
    if re.search(r"permission|approval|security|secret|sensitive|session|accesspolicy|authorized", files) or re.search(r"permis|aprobaci|secret|segur|autoriz", title):
        labels.add("security")
    if re.search(r"/tests?/|test\.|test\.java|\.spec\.", files) or task.checks != "DOC":
        labels.add("testing")
    if re.search(r"jdbc|sqlite|migration|repositoryintegration|repositorytest", files):
        labels.add("database")
    if re.search(r"executioncontrol|/runtime/|docker|ollama|agentloop", files):
        labels.add("runtime")
    if re.search(r"git|worktree", title + " " + files):
        labels.add("git")
    if re.search(r"memorysearch|/memory/|lucene", files):
        labels.add("rag")
    if any(p.endswith(".tsx") for p in task.files) or "usabilidad" in title:
        labels.add("ux")
    if re.search(r"gradle|package(-lock)?\.json|vite\.config|eslint|tsconfig", files):
        labels.add("build")
    if task.parallel:
        labels.add("parallel")
    if task.completed:
        labels.add("source:completed")
    if task.story:
        labels.add(f"story:US-{int(task.story[2:]):03d}")
    if task.priority:
        labels.add(f"priority:{task.priority}")
    return sorted(labels)


def label_definitions(tasks: list[Task], feature: str) -> dict:
    definitions = {}
    for task in tasks:
        for label in task_labels(task, feature):
            color, description = BASE_LABELS.get(label, ("C2E0C6", label))
            if label.startswith("fase:"):
                color, description = "FBCA04", f"Fase {task.phase}: {task.phase_name}"
            elif label.startswith("story:"):
                color, description = "D4C5F9", f"Historia {label[6:]} de la especificación"
            elif label.startswith("feature:"):
                color, description = "0052CC", f"Feature SDD {feature}"
            elif label.startswith("priority:"):
                color, description = "D93F0B", f"Prioridad {task.priority} de la historia; no omite alcance MVP"
            if len(label) > 50:
                fail(f"Label demasiado largo: {label}")
            definitions[label] = {"color": color, "description": description[:100]}
    return dict(sorted(definitions.items()))


def marker(feature: str, task_id: str) -> str:
    return f"<!-- zeko-task:{feature}:{task_id} -->"


def issue_title(task: Task, feature: str) -> str:
    title = f"[{feature}][{task.id}] {task.title}"
    if len(title) > 240:
        fail(f"{task.id}: título demasiado largo ({len(title)}); no se trunca automáticamente.")
    return title


def issue_body(task, feature, repo, source, branch, profiles, numbers=None):
    numbers = numbers or {}
    dependencies = [f"- {dep}" + (f" — #{numbers[dep]}" if dep in numbers else " — issue pendiente de importar") for dep in task.dependencies]
    mode = ("Tarea documental: ejecutar en la fase SDD propietaria (clarify/plan/checklist), no mediante implement."
            if task.phase == 0 else "No implementar hasta cerrar diseño, analyze y aprobación de la revisión correspondiente.")
    source_url = f"https://github.com/{repo}/blob/{quote(branch, safe='')}/{quote(source, safe='/')}#L{task.source_line}"
    check_table = "\n".join(f"| {name} | {value} |" for name, value in profiles.items())
    return f"""{marker(feature, task.id)}
# {task.id} — {task.title}

**Feature**: {feature} · **Fase**: {task.phase} — {task.phase_name}
**Historia**: {task.story or 'Transversal/documental'} · **Perfil**: {task.checks}
**Origen**: [tasks.md, línea {task.source_line}]({source_url})

{mode}

## Archivos en scope

{chr(10).join('- `' + path + '`' for path in task.files)}

## Dependencias

{chr(10).join(dependencies) if dependencies else 'Ninguna.'}

## Trazabilidad

{task.trace}

## Criterio de aceptación

{task.acceptance}

## Verificación

Perfil requerido: **{task.checks}**. Los comandos son previstos hasta implementar el setup. Ejecutar los checks pertinentes y registrar evidencia real; no omitir controles porque falte un proveedor.

| Perfil | Definición del documento fuente |
|---|---|
{check_table}

## Definition of Done

- [ ] Dependencias completas y scope respetado.
- [ ] Criterios de aceptación y checks aplicables con evidencia real.
- [ ] Una tarea, un diff, un Conventional Commit con task ID cuando corresponda.
- [ ] Sin Co-authored-by, firmas IA ni trailers automáticos de asistentes.
- [ ] Sin cambios de specs desde implement; evidencia en work/evidence/{task.id}/.
- [ ] Cambios del usuario preservados; no ampliación de permisos ni del MVP.

Paralelizable según tasks.md: **{'sí, únicamente con dependencias completas y archivos sin solapamiento' if task.parallel else 'no marcada [P]'}**.
Estado en fuente: **{'completada' if task.completed else 'pendiente'}**. La importación no cambia estado abierto/cerrado de issues existentes ni crea dependencias nativas de GitHub; los enlaces anteriores conservan la relación documental.
"""


def run_gh(*args: str) -> str:
    result = subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8", check=False)
    if result.returncode:
        raise RuntimeError(f"gh {' '.join(args[:3])} falló ({result.returncode}): {result.stderr.strip()}")
    return result.stdout.strip()


def get_existing(repo: str) -> tuple[list[dict], set[str]]:
    raw = run_gh("api", "--hostname", "github.com", "--paginate",
                 f"repos/{repo}/issues?state=all&per_page=100", "--jq", ".[] | select(.pull_request == null) | {number,title,body,html_url} | @json")
    issues = [json.loads(line) for line in raw.splitlines() if line.strip()]
    labels = run_gh("api", "--hostname", "github.com", "--paginate",
                    f"repos/{repo}/labels?per_page=100", "--jq", ".[].name")
    return issues, set(labels.splitlines())


def index_existing(existing: list[dict], tasks: list[Task], feature: str) -> dict:
    by_task = {}
    for task in tasks:
        tagged = [i for i in existing if marker(feature, task.id) in (i.get("body") or "")]
        if len(tagged) > 1:
            fail(f"{task.id}: varias issues con el mismo marcador; resolver antes de publicar.")
        legacy = re.compile(r"^(?:\[" + re.escape(feature) + r"\]\s*)?\[?"
                            + re.escape(task.id) + r"\]?(?=[:\s—-]|$)")
        collisions = [i for i in existing if i not in tagged and
                      (i["title"] == issue_title(task, feature) or legacy.match(i["title"]))]
        if collisions:
            fail(f"{task.id}: título existente sin marcador; no se duplica ni adopta automáticamente.")
        if tagged:
            by_task[task.id] = tagged[0]
    numbers = [i["number"] for i in by_task.values()]
    if len(numbers) != len(set(numbers)):
        fail("Una issue existente contiene marcadores de varias tareas.")
    return by_task


def publish(tasks, definitions, args, source, profiles, existing, existing_labels):
    indexed = index_existing(existing, tasks, args.feature)
    numbers = {key: value["number"] for key, value in indexed.items()}
    for name, definition in definitions.items():
        if name not in existing_labels:
            run_gh("label", "create", name, "--repo", f"github.com/{args.repo}",
                   "--color", definition["color"], "--description", definition["description"])
    results = []
    with tempfile.TemporaryDirectory(prefix="zeko-issues-", dir=args.output) as temporary:
        for task in topological(tasks):
            if task.id in indexed:
                results.append({"task": task.id, "action": "skip-existing", "number": numbers[task.id]})
                print(f"SKIP {task.id}: #{numbers[task.id]} (conservada sin editar)")
                continue
            body = issue_body(task, args.feature, args.repo, source, args.branch, profiles, numbers)
            body_file = Path(temporary) / f"{task.id}.md"
            body_file.write_text(body, encoding="utf-8", newline="\n")
            command = ["issue", "create", "--repo", f"github.com/{args.repo}",
                       "--title", issue_title(task, args.feature), "--body-file", str(body_file)]
            for label in task_labels(task, args.feature):
                command.extend(["--label", label])
            url = run_gh(*command)
            match = re.fullmatch(r"https://github\.com/" + re.escape(args.repo) + r"/issues/(\d+)", url, flags=re.I)
            if not match:
                raise RuntimeError(f"Respuesta de creación no reconocida para {task.id}; volver a consultar GitHub antes de reintentar.")
            numbers[task.id] = int(match.group(1))
            results.append({"task": task.id, "action": "created", "number": numbers[task.id], "url": url})
            (args.output / "publish-results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"CREATED {task.id}: {url}")
    (args.output / "publish-results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return results


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--dry-run", action="store_true", help="Genera preview local; no publica nada")
    modes.add_argument("--apply", action="store_true", help="Crea labels faltantes e issues usando gh")
    parser.add_argument("--repo", required=True, help="OWNER/REPO en github.com")
    parser.add_argument("--feature", default="001-zeko-mvp")
    parser.add_argument("--tasks", type=Path, default=Path("specs/001-zeko-mvp/tasks.md"))
    parser.add_argument("--branch", default="feature/001-zeko-mvp", help="Ref para links a la fuente")
    parser.add_argument("--source-path", help="Ruta relativa del tasks.md en GitHub, si difiere")
    parser.add_argument("--output", type=Path, default=Path("work/task-to-issues"))
    parser.add_argument("--expect-count", type=int)
    parser.add_argument("--check-remote", action="store_true", help="En dry-run consulta labels/issues sin modificarlos")
    args = parser.parse_args(argv)
    if not REPO.fullmatch(args.repo) or not FEATURE.fullmatch(args.feature):
        fail("Repo o feature inválidos.")
    if not args.branch or any(ord(c) < 32 for c in args.branch):
        fail("Branch inválida.")
    source = args.source_path or f"specs/{args.feature}/tasks.md"
    if PurePosixPath(source).is_absolute() or ".." in PurePosixPath(source).parts or "\\" in source or ":" in source:
        fail("--source-path debe ser relativo al repositorio.")
    content = args.tasks.read_text(encoding="utf-8-sig")
    tasks, profiles = parse_document(content)
    if args.expect_count is not None and len(tasks) != args.expect_count:
        fail(f"Se esperaban {args.expect_count} tareas; se encontraron {len(tasks)}.")
    definitions = label_definitions(tasks, args.feature)
    existing, existing_labels, indexed = [], set(), {}
    if args.apply or args.check_remote:
        existing, existing_labels = get_existing(args.repo)
        indexed = index_existing(existing, tasks, args.feature)
    numbers = {key: value["number"] for key, value in indexed.items()}
    previews = [{**asdict(t), "issue_title": issue_title(t, args.feature),
                 "labels": task_labels(t, args.feature),
                 "planned_action": "skip-existing" if t.id in indexed else "create",
                 "body": issue_body(t, args.feature, args.repo, source, args.branch, profiles, numbers)} for t in tasks]
    summary = {"mode": "apply" if args.apply else "dry-run", "repo": args.repo,
               "feature": args.feature, "tasks": len(tasks), "labels": len(definitions),
               "dependency_edges": sum(len(t.dependencies) for t in tasks),
               "phases": dict(sorted(Counter(t.phase for t in tasks).items())),
               "stories": dict(Counter(t.story or "transversal" for t in tasks)),
               "label_counts": dict(sorted(Counter(l for t in previews for l in t["labels"]).items())),
               "remote_checked": bool(args.apply or args.check_remote),
               "existing_issues": len(indexed), "issues_to_create": len(tasks) - len(indexed),
               "source_sha256": hashlib.sha256(content.encode("utf-8")).hexdigest()}
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    lock = args.output / ".task-to-issues.lock"
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    try:
        os.close(descriptor)
        for name, value in [("summary.json", summary), ("labels.json", definitions), ("issues.json", previews)]:
            (args.output / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for preview in previews:
            (args.output / f"{preview['id']}.md").write_text(preview["body"], encoding="utf-8", newline="\n")
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        if args.apply:
            publish(tasks, definitions, args, source, profiles, existing, existing_labels)
        else:
            print(f"DRY-RUN OK: {len(tasks)} issues preparadas; 0 escrituras a GitHub. Preview: {args.output}")
    finally:
        lock.unlink()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, RuntimeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
