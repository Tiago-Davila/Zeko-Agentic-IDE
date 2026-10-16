# T119 Claude CLI smoke result

- Date: 2026-09-26 (America/Argentina/Buenos_Aires)
- Runtime: Windows 11, Node 24.10.0, Claude Code 2.1.283
- Flow: `goal → a`, isolated Git fixture, explicit model `claude-sonnet-5`
- Run: `951bd769-3ea8-7c68-8a59-a94e3018fa2d` (final smoke)
- Outcome: `all_succeeded`; node report `valid` / `COMPLETED`
- Preflight: installed and auth verified; only structured status escaped the adapter
- Scope check: worktree diff contained the requested `src/math.js` change; original fixture status was clean and branch unchanged
- CLAUDE.md: its unique instruction marker appeared above the new export under `--restricted`
- Estimated cost: USD 0.02525, `list_price_estimate`
- Supervised agent process: ended and recorded in run history
- CLI host: exited normally after `run.finished`; runtime shutdown closed its process-snapshot worker

This duplicate evidence is outside `specs/` because the user disallowed changes there except task checkboxes.
