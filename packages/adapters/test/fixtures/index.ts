export interface FixtureGroup {
  readonly events?: readonly string[];
  readonly samples: Readonly<Record<string, string>>;
}

export interface AdapterFixtureIndex {
  readonly claude: FixtureGroup;
  readonly codex: FixtureGroup;
}

export const FIXTURE_INDEX = {
  claude: {
    events: [
      "claude/events/assistant.text.json", "claude/events/assistant.thinking.json",
      "claude/events/assistant.tool_use.json", "claude/events/control_response.json",
      "claude/events/rate_limit_event.json", "claude/events/result.error_during_execution.json",
      "claude/events/result.error_max_budget_usd.json", "claude/events/result.success.json",
      "claude/events/stream_event.content_block_delta.input_json_delta.json",
      "claude/events/stream_event.content_block_delta.signature_delta.json",
      "claude/events/stream_event.content_block_delta.text_delta.json",
      "claude/events/stream_event.content_block_delta.thinking_delta.json",
      "claude/events/stream_event.content_block_start.text.json",
      "claude/events/stream_event.content_block_start.thinking.json",
      "claude/events/stream_event.content_block_start.tool_use.json",
      "claude/events/stream_event.content_block_stop.json", "claude/events/stream_event.message_delta.json",
      "claude/events/stream_event.message_start.json", "claude/events/stream_event.message_stop.json",
      "claude/events/system.init.json", "claude/events/system.permission_denied.json",
      "claude/events/system.status.json", "claude/events/system.task_notification.json",
      "claude/events/system.task_started.json", "claude/events/system.thinking_tokens.json",
      "claude/events/user.text.json", "claude/events/user.tool_result.json",
      "claude/events/user.tool_result_error.json",
    ],
    samples: {
      verboseRaw: "claude/q1-verbose-raw.jsonl",
      invalidModel: "claude/q3-error-bad-model.json",
      cancel: "claude/q7-cancel.json",
      permissions: "claude/q6-perms.json",
      strictSchema: "claude/001b/a-schema.json",
    },
  },
  codex: {
    events: [
      "codex/events/error.json", "codex/events/item.completed.agent_message.json",
      "codex/events/item.completed.command_execution.completed.json",
      "codex/events/item.completed.command_execution.failed.json", "codex/events/item.completed.error.json",
      "codex/events/item.completed.file_change.completed.json",
      "codex/events/item.completed.mcp_tool_call.completed.json",
      "codex/events/item.completed.mcp_tool_call.failed.json", "codex/events/item.completed.reasoning.json",
      "codex/events/item.completed.web_search.json", "codex/events/item.started.command_execution.in_progress.json",
      "codex/events/item.started.file_change.in_progress.json", "codex/events/item.started.mcp_tool_call.in_progress.json",
      "codex/events/item.started.web_search.json", "codex/events/thread.started.json",
      "codex/events/turn.completed.json", "codex/events/turn.failed.json", "codex/events/turn.started.json",
    ],
    samples: {
      termination: "codex/q4-termination.json",
      structuredOutput: "codex/q6-structured.json",
      sandbox: "codex/q8-sandbox.json",
      cancel: "codex/q9-cancel.json",
    },
  },
} as const satisfies AdapterFixtureIndex;

export const ALL_FIXTURE_PATHS = [
  ...FIXTURE_INDEX.claude.events,
  ...Object.values(FIXTURE_INDEX.claude.samples),
  ...FIXTURE_INDEX.codex.events,
  ...Object.values(FIXTURE_INDEX.codex.samples),
] as const;
