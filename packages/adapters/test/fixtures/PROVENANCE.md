# Fixture provenance

These files are curated copies of the named spike samples. Their directory layout is preserved
under `claude/` and `codex/`; `index.ts` is the typed list used by tests and the replay runner.

| Fixture paths | Source |
| --- | --- |
| `claude/events/*` | `spikes/001-claude-chain/samples/events/*` |
| `claude/q1-verbose-raw.jsonl` | `spikes/001-claude-chain/samples/q1-verbose-raw.jsonl` |
| `claude/q3-error-bad-model.json` | `spikes/001-claude-chain/samples/q3-error-bad-model.json` |
| `claude/q7-cancel.json` | `spikes/001-claude-chain/samples/q7-cancel.json` |
| `claude/q6-perms.json` | `spikes/001-claude-chain/samples/q6-perms.json` |
| `claude/001b/a-schema.json` | `spikes/001b-claude-edges/samples/a-schema.json` |
| `codex/events/*` | `spikes/001c-codex/samples/events/*` |
| `codex/q4-termination.json` | `spikes/001c-codex/samples/q4-termination.json` |
| `codex/q6-structured.json` | `spikes/001c-codex/samples/q6-structured.json` |
| `codex/q8-sandbox.json` | `spikes/001c-codex/samples/q8-sandbox.json` |
| `codex/q9-cancel.json` | `spikes/001c-codex/samples/q9-cancel.json` |

The source samples are retained unchanged. The fixture leak test scans both source and curated
trees so future sample changes are checked before they can enter tests.
