import { z } from "zod";

export const AgentIdSchema = z.enum(["claude-code", "codex", "fake"]);
export const PlatformSchema = z.enum(["win32", "linux"]);

export const AgentCapabilitiesSchema = z.object({
  terminal: z.object({ canDisable: z.boolean() }).strict(),
  confinement: z.object({
    noTerminal: z.enum(["full", "write_only"]).optional(),
    withTerminal: z.enum(["none", "write_only"]),
  }).strict(),
  writeScopeEnforcement: z.object({ unrestricted: z.enum(["prevent", "detect"]), partial: z.enum(["prevent", "detect"]) }).strict(),
  commandAllowlist: z.object({ supported: z.boolean(), shell: z.enum(["PowerShell", "Bash"]).nullable(), readonlyAutoApproved: z.boolean() }).strict(),
  reportsDenials: z.boolean(),
  infersDenials: z.boolean(),
  supportsTurnLimit: z.boolean(),
  timeLimit: z.literal("engine"),
  orderlyInterrupt: z.boolean(),
  network: z.enum(["terminal_only", "none"]),
  structuredOutput: z.boolean(),
  reportRequest: z.enum(["resume_fork", "exec_fork"]),
  explicitModel: z.boolean(),
  reportsCost: z.boolean(),
  reportsConsumption: z.boolean(),
  subscriptionUsage: z.enum(["live", "per_node"]),
  authModes: z.array(z.object({ mode: z.enum(["subscription", "api_key", "detect"]), verified: z.boolean() }).strict()),
  infraFailureClasses: z.array(z.enum(["process_create", "session_lock"])),
  processTree: z.enum(["windows_process_tree", "process_group", "native_process_tree"]),
}).strict();

export type AgentId = z.infer<typeof AgentIdSchema>;
export type Platform = z.infer<typeof PlatformSchema>;
export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;
