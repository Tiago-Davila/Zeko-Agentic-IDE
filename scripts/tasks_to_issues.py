#!/usr/bin/env python3
"""Convierte las tareas de tasks.md en issues de GitHub, con labels por fase, área y marcadores.

Por defecto es un dry run: parsea, valida y muestra lo que haría, sin crear nada.
Con --apply crea los labels que falten y los issues de las tareas que todavía no tienen uno.

Uso:
    python scripts/tasks_to_issues.py                      # dry run
    python scripts/tasks_to_issues.py --show-body T058     # muestra el cuerpo de un issue
    python scripts/tasks_to_issues.py --only T001,T002     # limita a esas tareas
    python scripts/tasks_to_issues.py --apply              # crea labels e issues
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_TASKS = Path("specs/001-agent-flow-canvas/tasks.md")

TASK_START = re.compile(r"^- \[[ xX]\] (T\d{3})\b(.*)$")
MARKER = re.compile(r"^\s*\[(P|REAL|US\d+)\]")
PHASE_HEADING = re.compile(r"^## Phase (\d+):\s*(.+?)\s*$")
ISSUE_TASK_ID = re.compile(r"\bT\d{3}\b")
TASK_REF = re.compile(r"\bT(\d{3})(?:\s*[–-]\s*T(\d{3}))?\b")
FIELD = re.compile(r"\*\*(Archivos|Cubre|Base|Depende de)\*\*:")
BACKTICK = re.compile(r"`([^`]+)`")
REQ_RANGE = re.compile(
    r"\b(FR|NFR|SC)-(\d{3})(a?)(?:\.\d+)?(?:\s*[–-]\s*(?:(?:FR|NFR|SC)-)?(\d{3}))?"
)
STORY_LEGEND = re.compile(r"(US\d+) ([^,)]+?)(?=,|\)| y US|\.$)")

TITLE_MAX = 110
TITLE_MIN_BEFORE_LIST = 30
LIST_ITEM = re.compile(r"^\s*(?:-|\d+\.)\s+(.+)$", re.M)

SECURITY_REQS = {"NFR-007", "NFR-009", "FR-019", "FR-020", "FR-021", "FR-022", "FR-058"}
# Solo palabras inequívocas: "sandbox" o "confinamiento" aparecen en tareas que no son de seguridad.
SECURITY_WORDS = re.compile(
    r"secreto|secret|redact|credencial|clave de API|claves de API|email|datos personales|"
    r"CODEX_API_KEY|por nombre ni por patrón",
    re.IGNORECASE,
)
PERFORMANCE_REQS = {"NFR-002", "NFR-003", "NFR-004", "SC-002", "SC-003"}

BACKEND_PREFIXES = (
    "packages/contracts/", "packages/core/", "packages/adapters/", "packages/git/",
    "packages/storage/", "packages/runtime/", "packages/i18n/", "packages/testing/",
    "apps/desktop/src/main/", "apps/desktop/src/engine-host/", "apps/desktop/src/preload/",
    "packages/*",
)
INFRA_FILES = re.compile(
    r"^(package\.json|pnpm-workspace\.yaml|\.npmrc|\.nvmrc|\.gitignore|tsconfig[\w.]*\.json|"
    r"vitest[\w.]*\.ts|eslint\.config\.js|\.prettierrc|\.github/|scripts/|"
    r"apps/desktop/electron-builder\.yml|apps/desktop/electron\.vite\.config\.ts|"
    r"apps/[\w-]+/package\.json|apps/[\w-]+/tsconfig\.json)"
)

# name -> (color, description). Las de fase y de historia se agregan al parsear.
STATIC_LABELS: dict[str, tuple[str, str]] = {
    "backend": ("1d76db", "Motor, contratos, adaptadores, git, storage o runtime"),
    "frontend": ("e99695", "UI del renderer de la app de escritorio"),
    "desktop": ("c5def5", "App de escritorio: main, engine host, preload o renderer"),
    "cli": ("bfdadc", "CLI zeko"),
    "infra": ("5319e7", "Monorepo, build, lint, tests o CI"),
    "docs": ("0075ca", "Specs, evidencia o spikes"),
    "testing": ("fbca04", "La tarea solo agrega tests"),
    "security": ("b60205", "Secretos, redacción, confinamiento o terminación de procesos"),
    "performance": ("d93f0b", "Requisitos de rendimiento o de tiempos"),
    "claude-code": ("d4c5f9", "Adaptador o comportamiento de Claude Code"),
    "codex": ("c2e0c6", "Adaptador o comportamiento de Codex"),
    "real-provider": ("000000", "[REAL] Requiere Claude Code o Codex reales; nunca corre en CI"),
    "paralelizable": ("0e8a16", "[P] Se puede hacer en paralelo con otras tareas de su fase"),
}

PHASE_COLORS = [
    "f9d0c4", "fef2c0", "d4c5f9", "c5def5", "bfd4f2", "d1f0c4", "fad8c7", "e6e6e6",
    "fbe7b5", "c2e0c6", "d4f4dd", "f7c6c7", "bfdadc", "e4d0f5", "ffd8b1",
]
STORY_COLOR = "ededed"


@dataclass
class Task:
    task_id: str
    phase: int
    phase_title: str
    markers: list[str]
    lead: str
    block: str
    fields: dict[str, str] = field(default_factory=dict)
    files: list[str] = field(default_factory=list)
    requirements: set[str] = field(default_factory=set)
    depends_on: list[str] = field(default_factory=list)
    title: str = ""
    truncated: bool = False
    labels: list[str] = field(default_factory=list)


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def expand_requirements(text: str) -> set[str]:
    found: set[str] = set()
    for prefix, start, suffix, end in REQ_RANGE.findall(text):
        if suffix:
            found.add(f"{prefix}-{start}a")
            continue
        last = int(end) if end else int(start)
        for number in range(int(start), last + 1):
            found.add(f"{prefix}-{number:03d}")
    return found


def expand_task_refs(text: str) -> list[str]:
    refs: list[str] = []
    for start, end in TASK_REF.findall(text):
        last = int(end) if end else int(start)
        refs.extend(f"T{n:03d}" for n in range(int(start), last + 1))
    return list(dict.fromkeys(refs))


def split_fields(block: str) -> dict[str, str]:
    matches = list(FIELD.finditer(block))
    fields: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(block)
        fields[match.group(1)] = " ".join(block[match.end():end].split()).rstrip(". ")
    return fields


def clean_inline(text: str) -> str:
    text = text.replace("**", "").replace("`", "")
    return " ".join(text.split())


def make_title(task_id: str, lead: str) -> tuple[str, bool]:
    flat = clean_inline(lead)
    # Corta antes de una lista introducida con ":" o al final de la primera oración.
    cut = len(flat)
    for pattern in (r":\s+-\s", r":\s+\d+\.\s", r"\.\s", r":$"):
        found = re.search(pattern, flat)
        if found:
            cut = min(cut, found.start())
    sentence = flat[:cut].rstrip(" .:;,")
    # "Redactor:" seguido de una lista da un título vacío de contenido: se suma el primer ítem.
    first_item = LIST_ITEM.search(lead)
    if len(sentence) < TITLE_MIN_BEFORE_LIST and first_item:
        sentence = f"{sentence} — {clean_inline(first_item.group(1)).rstrip(' .;:,')}"
    truncated = False
    if len(sentence) > TITLE_MAX:
        sentence = sentence[:TITLE_MAX].rsplit(" ", 1)[0].rstrip(" ,;:(") + "…"
        truncated = True
    return f"{task_id}: {sentence}", truncated


def parse_tasks(path: Path) -> tuple[list[Task], dict[str, str], list[str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    tasks: list[Task] = []
    stories: dict[str, str] = {}
    warnings: list[str] = []
    phase, phase_title = 0, ""

    # La leyenda de historias ocupa varias líneas: se busca en todo el bloque de marcadores.
    legend = re.search(r"\*\*\[US#\]\*\*:(.+?)(?:\n\n|\n- \*\*)", "\n".join(lines), re.S)
    if legend:
        for story_id, description in STORY_LEGEND.findall(" ".join(legend.group(1).split())):
            stories[story_id] = description.strip().rstrip(".")

    index = 0
    while index < len(lines):
        line = lines[index]
        heading = PHASE_HEADING.match(line)
        if heading:
            phase, phase_title = int(heading.group(1)), heading.group(2)
        elif line.startswith("## "):
            phase, phase_title = 0, ""

        start = TASK_START.match(line)
        if not start:
            index += 1
            continue

        task_id, rest = start.groups()
        markers: list[str] = []
        while True:
            marker = MARKER.match(rest)
            if not marker:
                break
            markers.append(marker.group(1))
            rest = rest[marker.end():]

        body_lines = [rest.strip()]
        index += 1
        while index < len(lines):
            nxt = lines[index]
            if nxt.strip() and not nxt.startswith((" ", "\t")):
                break
            body_lines.append(nxt[2:] if nxt.startswith("  ") else nxt.strip())
            index += 1
        while body_lines and not body_lines[-1].strip():
            body_lines.pop()

        block = "\n".join(body_lines)
        first_field = FIELD.search(block)
        lead = block[: first_field.start()] if first_field else block
        # El título sale del primer párrafo, no de las listas de detalle.
        lead_first_paragraph = lead.split("\n\n", 1)[0]

        task = Task(
            task_id=task_id,
            phase=phase,
            phase_title=phase_title,
            markers=markers,
            lead=lead.strip(),
            block=block,
        )
        task.fields = split_fields(block)
        task.files = BACKTICK.findall(task.fields.get("Archivos", ""))
        task.requirements = expand_requirements(task.fields.get("Cubre", ""))
        task.depends_on = expand_task_refs(task.fields.get("Depende de", ""))
        task.title, task.truncated = make_title(task_id, lead_first_paragraph)
        if phase == 0:
            warnings.append(f"{task_id}: está fuera de una sección '## Phase N'")
        tasks.append(task)

    return tasks, stories, warnings


def area_labels(task: Task) -> set[str]:
    labels: set[str] = set()
    for file in task.files:
        if file.startswith(BACKEND_PREFIXES):
            labels.add("backend")
        if file.startswith("apps/desktop/src/renderer/"):
            labels.add("frontend")
        if file.startswith("apps/desktop/"):
            labels.add("desktop")
        if file.startswith("apps/cli/"):
            labels.add("cli")
            labels.add("backend")
        if INFRA_FILES.match(file):
            labels.add("infra")
        if file.startswith(("specs/", "spikes/")):
            labels.add("docs")
        if "/claude-code/" in file:
            labels.add("claude-code")
        if "/codex/" in file:
            labels.add("codex")

    code_files = [f for f in task.files if not f.startswith(("specs/", "spikes/"))]
    if code_files and all("/test/" in f or f.endswith(".test.ts") for f in code_files):
        labels.add("testing")

    # Solo el título: el cuerpo menciona a los dos agentes en tareas que no son de ninguno.
    if re.search(r"\bClaude\b", task.title):
        labels.add("claude-code")
    if re.search(r"\bCodex\b", task.title):
        labels.add("codex")
    if task.requirements & SECURITY_REQS or SECURITY_WORDS.search(task.block):
        labels.add("security")
    if task.requirements & PERFORMANCE_REQS:
        labels.add("performance")
    return labels


def assign_labels(tasks: list[Task]) -> None:
    for task in tasks:
        labels = {f"fase {task.phase}"} if task.phase else set()
        labels |= area_labels(task)
        for marker in task.markers:
            if marker == "P":
                labels.add("paralelizable")
            elif marker == "REAL":
                labels.add("real-provider")
            else:
                labels.add(marker)
        task.labels = sorted(labels, key=label_sort_key)


def label_sort_key(name: str) -> tuple[int, int, str]:
    if name.startswith("fase "):
        return (0, int(name.split()[1]), name)
    if re.fullmatch(r"US\d+", name):
        return (2, int(name[2:]), name)
    return (1, 0, name)


def build_label_catalog(tasks: list[Task], stories: dict[str, str]) -> dict[str, tuple[str, str]]:
    catalog: dict[str, tuple[str, str]] = {}
    phases = {task.phase: task.phase_title for task in tasks if task.phase}
    for number, title in sorted(phases.items()):
        color = PHASE_COLORS[(number - 1) % len(PHASE_COLORS)]
        catalog[f"fase {number}"] = (color, clean_inline(f"Fase {number}: {title}")[:100])
    catalog.update(STATIC_LABELS)
    used_stories = sorted({m for t in tasks for m in t.markers if m.startswith("US")},
                          key=lambda s: int(s[2:]))
    for story in used_stories:
        catalog[story] = (STORY_COLOR, f"Historia {story}: {stories.get(story, 'ver spec.md')}"[:100])
    return catalog


def issue_body(task: Task, tasks_path: Path, issue_numbers: dict[str, int]) -> str:
    markers = " ".join(f"`[{m}]`" for m in task.markers) or "—"
    deps = ", ".join(
        f"#{issue_numbers[d]} ({d})" if d in issue_numbers else d for d in task.depends_on
    ) or "—"
    return "\n".join([
        f"**Tarea**: {task.task_id} · **Fase {task.phase}**: {task.phase_title}",
        f"**Marcadores**: {markers}",
        f"**Depende de**: {deps}",
        "",
        "---",
        "",
        task.block,
        "",
        "---",
        f"_Generado desde `{tasks_path.as_posix()}` por `scripts/tasks_to_issues.py`. "
        "Una tarea = un diff = un commit (Principio XX)._",
    ])


def github_repo() -> str:
    url = run(["git", "config", "--get", "remote.origin.url"]).strip()
    match = re.fullmatch(r"(?:https://github\.com/|git@github\.com:)([\w.-]+)/([\w.-]+?)(?:\.git)?/?",
                         url)
    if not match:
        fail(f"el remoto 'origin' no es un repositorio de GitHub: {url!r}. No se crea nada.")
    return f"{match.group(1)}/{match.group(2)}"


def run(command: list[str], input_text: str | None = None) -> str:
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8",
                            input=input_text, check=False)
    if result.returncode != 0:
        fail(f"falló `{' '.join(command[:4])} …`: {result.stderr.strip()}")
    return result.stdout


def existing_issues(repo: str) -> dict[str, int]:
    raw = run(["gh", "issue", "list", "--repo", repo, "--state", "all", "--limit", "2000",
               "--json", "number,title"])
    found: dict[str, int] = {}
    for issue in json.loads(raw):
        for task_id in ISSUE_TASK_ID.findall(issue["title"]):
            found.setdefault(task_id, issue["number"])
    return found


def existing_labels(repo: str) -> set[str]:
    raw = run(["gh", "label", "list", "--repo", repo, "--limit", "1000", "--json", "name"])
    return {label["name"] for label in json.loads(raw)}


def validate(tasks: list[Task]) -> list[str]:
    problems: list[str] = []
    ids = [t.task_id for t in tasks]
    known = set(ids)
    seen: set[str] = set()
    for position, task in enumerate(tasks, start=1):
        if task.task_id in seen:
            problems.append(f"{task.task_id}: ID duplicado")
        seen.add(task.task_id)
        if int(task.task_id[1:]) != position:
            problems.append(f"{task.task_id}: fuera de secuencia (posición {position})")
        for name in ("Archivos", "Cubre", "Depende de"):
            if name not in task.fields:
                problems.append(f"{task.task_id}: sin **{name}**")
        if "Archivos" in task.fields and not task.files:
            problems.append(f"{task.task_id}: **Archivos** sin rutas entre backticks")
        for dep in task.depends_on:
            if dep not in known:
                problems.append(f"{task.task_id}: depende de {dep}, que no existe")
        if not any(label.startswith("fase ") for label in task.labels):
            problems.append(f"{task.task_id}: sin label de fase")
        area = {"backend", "frontend", "desktop", "cli", "infra", "docs"}
        if not area & set(task.labels):
            problems.append(f"{task.task_id}: sin label de área (backend/frontend/infra/docs…)")
        if len(task.title) < 15:
            problems.append(f"{task.task_id}: título sospechosamente corto: {task.title!r}")
    return problems


def print_report(tasks: list[Task], catalog: dict[str, tuple[str, str]], remote: dict[str, int],
                 labels_on_repo: set[str] | None, problems: list[str], warnings: list[str]) -> None:
    print(f"\n== Tareas parseadas: {len(tasks)}")
    for task in tasks:
        state = f"  (ya existe: #{remote[task.task_id]})" if task.task_id in remote else ""
        print(f"{task.title}{state}")
        print(f"    labels: {', '.join(task.labels)}")

    print(f"\n== Labels ({len(catalog)})")
    usage = {name: sum(name in t.labels for t in tasks) for name in catalog}
    for name, (color, description) in catalog.items():
        status = ""
        if labels_on_repo is not None:
            status = "existe" if name in labels_on_repo else "NUEVO"
        print(f"  {name:<15} #{color}  {usage[name]:>3} tareas  {status:<6}  {description}")

    truncated = [t.task_id for t in tasks if t.truncated]
    print("\n== Resumen")
    print(f"  issues a crear: {sum(t.task_id not in remote for t in tasks)}")
    print(f"  ya tienen issue (se saltean): {sum(t.task_id in remote for t in tasks)}")
    print(f"  títulos truncados a {TITLE_MAX} caracteres: {len(truncated)} {truncated}")
    print(f"  tareas por fase: " + ", ".join(
        f"{p}:{sum(t.phase == p for t in tasks)}" for p in sorted({t.phase for t in tasks})))
    if warnings:
        print("\n== Advertencias")
        for warning in warnings:
            print(f"  - {warning}")
    print(f"\n== Problemas de parseo o validación: {len(problems)}")
    for problem in problems:
        print(f"  - {problem}")


def apply_changes(repo: str, tasks: list[Task], catalog: dict[str, tuple[str, str]],
                  remote: dict[str, int], labels_on_repo: set[str], tasks_path: Path) -> None:
    for name, (color, description) in catalog.items():
        if name not in labels_on_repo:
            run(["gh", "label", "create", name, "--repo", repo, "--color", color,
                 "--description", description])
            print(f"label creado: {name}")

    numbers = dict(remote)
    created: list[Task] = []
    for task in tasks:
        if task.task_id in remote:
            print(f"{task.task_id} ya tiene un issue (#{remote[task.task_id]}), se saltea")
            continue
        url = create_issue(repo, task, issue_body(task, tasks_path, numbers))
        numbers[task.task_id] = int(url.rstrip("/").rsplit("/", 1)[1])
        created.append(task)
        print(f"{task.task_id} → {url}")

    # Segunda pasada: enlaza las dependencias con los números de issue ya conocidos.
    for task in created:
        if any(dep in numbers and dep not in remote for dep in task.depends_on):
            write_body_and_run(["gh", "issue", "edit", str(numbers[task.task_id]), "--repo", repo],
                               issue_body(task, tasks_path, numbers))


def create_issue(repo: str, task: Task, body: str) -> str:
    command = ["gh", "issue", "create", "--repo", repo, "--title", task.title]
    for label in task.labels:
        command += ["--label", label]
    return write_body_and_run(command, body).strip()


def write_body_and_run(command: list[str], body: str) -> str:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".md", delete=False) as handle:
        handle.write(body)
        body_path = handle.name
    try:
        return run(command + ["--body-file", body_path])
    finally:
        Path(body_path).unlink(missing_ok=True)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tasks", type=Path, default=DEFAULT_TASKS, help="ruta a tasks.md")
    parser.add_argument("--only", help="IDs separados por coma, por ejemplo T001,T002")
    parser.add_argument("--show-body", metavar="TASK_ID", help="imprime el cuerpo del issue de una tarea")
    parser.add_argument("--offline", action="store_true",
                        help="no consulta GitHub (no detecta issues ni labels existentes)")
    parser.add_argument("--apply", action="store_true", help="crea labels e issues de verdad")
    args = parser.parse_args()

    if not args.tasks.is_file():
        fail(f"no existe {args.tasks}")
    tasks, stories, warnings = parse_tasks(args.tasks)
    if not tasks:
        fail("no se encontró ninguna tarea con el formato '- [ ] T###'")
    assign_labels(tasks)
    catalog = build_label_catalog(tasks, stories)
    problems = validate(tasks)

    if args.only:
        wanted = {item.strip() for item in args.only.split(",")}
        unknown = wanted - {t.task_id for t in tasks}
        if unknown:
            fail(f"IDs inexistentes en --only: {sorted(unknown)}")
        tasks = [t for t in tasks if t.task_id in wanted]

    if args.show_body:
        match = next((t for t in tasks if t.task_id == args.show_body), None)
        if not match:
            fail(f"no existe la tarea {args.show_body}")
        print(f"TÍTULO: {match.title}\nLABELS: {', '.join(match.labels)}\n")
        print(issue_body(match, args.tasks, {}))
        return

    repo = None if args.offline and not args.apply else github_repo()
    remote: dict[str, int] = {}
    labels_on_repo: set[str] | None = None
    if repo:
        print(f"Repositorio (del remoto origin): {repo}")
        remote = existing_issues(repo)
        labels_on_repo = existing_labels(repo)

    print_report(tasks, catalog, remote, labels_on_repo, problems, warnings)

    if not args.apply:
        print("\nDry run: no se creó nada. Usá --apply para crear labels e issues.")
        return
    if problems:
        fail("hay problemas de parseo o validación; corregilos antes de usar --apply")
    assert repo is not None and labels_on_repo is not None
    apply_changes(repo, tasks, catalog, remote, labels_on_repo, args.tasks)


if __name__ == "__main__":
    main()
