# 001d — Claude gaps mini-spike

Date: 2026-09-26 · Windows 11 · Claude Code 2.1.283 · model `claude-sonnet-5`

Only sanitized outcomes are retained here. Raw `claude auth status` output includes account identifiers, so it was inspected locally and not saved. The required update to `specs/001-agent-flow-canvas/research.md` was intentionally not made because the task restricts edits under `specs/` to checkboxes in `tasks.md`.

## U-02 — partial path permissions

In an isolated disposable directory, Claude ran with `--restricted --permission-mode acceptEdits` and `--allowedTools Read Write(src/**) Edit(src/**) Glob Grep`. The model created `src/inside.txt` and also created `docs/outside.txt`; `result.permission_denials` contained no denial. The workspace was disposable and outside the repository.

Conclusion: the tested selector form did not confine writes to `src/**`. Partial scope must remain post-run detection (`WRITE_OUTSIDE_SCOPE`), not a prevention claim. This does not establish whether another path-selector spelling or CLI version behaves differently. Sanitized sample: [samples/path-permission.json](./samples/path-permission.json).

## U-03 — authentication check without a model call

`claude auth status` exits locally and returns JSON with `loggedIn` and `authMethod`; no prompt or model was invoked. Its output also contains personal account and organization data. The implementation therefore parses only the boolean and auth-method fields and never returns or persists the raw output. A logged-out result must be treated as verified `not_authenticated`; an unknown/invalid response remains unknown.

## U-04 — stdin after `result`

With `--input-format stream-json`, the process remained alive for a four-second observation after emitting `result` while stdin stayed open. Ending stdin then closed the process (exit 1 in this max-turn-limited probe). This validates closing stdin at `result`; it does not establish that the process exits on its own.

## U-07 — `CLAUDE.md` with `--restricted`

An isolated workspace `CLAUDE.md` instruction was followed while using `--restricted`: the created file contained its unique marker. The same instruction was also followed by the successful Zeko CLI smoke below. In this version, `--restricted` did not suppress project `CLAUDE.md` instructions.

## T119 — Zeko CLI smoke

Ran `node apps/cli/dist/src/index.js run claude-smoke --project <isolated-fixture> --json` against a disposable Git repo. The final `goal → a` run (`951bd769-3ea8-7c68-8a59-a94e3018fa2d`) finished `all_succeeded`; preflight found Claude 2.1.283 and verified subscription auth without exposing account data. The node's persisted model was explicitly `claude-sonnet-5`, its report state was `valid` / `COMPLETED`, and its only observed change was the requested function in the isolated worktree. The fixture repo remained clean on its original `master` branch; the worktree carried the change on its `zeko/<run>/a` branch. Estimated cost was USD 0.02525 (list-price basis). After closing the process-snapshot worker from `runtime.close()`, the CLI process exited normally after `run.finished`.

The T119 evidence artifact requested under `specs/001-agent-flow-canvas/evidence/` was not written because of the same `specs/` restriction.
