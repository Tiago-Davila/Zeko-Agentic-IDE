# T131 — Codex real smoke

Executed 2026-09-26 with the CLI against a disposable Git repository outside the system temp directory. The smoke flow had one read-only Codex node and used the real native Codex executable.

- Codex CLI `0.155.1`; `codex login status` succeeded. No account identifier was recorded.
- The CLI node completed with a schema-valid `COMPLETED` report. The Codex node had no cost figure; the aggregate was marked partial.
- The rollout reported explicit model `gpt-6-sol` and effort `low`.
- An email-pattern scan of the rollout was clean.
- The original fixture repository retained its starting HEAD and working-tree status after both runs.
- A real `exec fork` in the same worktree returned a valid report with `--json`, `--output-schema`, `--ignore-user-config`, and `--ignore-rules`.

U-14 outcome: retain fresh launch as the default report strategy. Keep `exec fork` behind the adapter option: the flags were accepted, but normal turns already supplied a valid report. The harness and a local evidence copy are stored outside `specs/001-agent-flow-canvas` per the requested spec-file restriction; that directory was not edited for evidence or research updates.
