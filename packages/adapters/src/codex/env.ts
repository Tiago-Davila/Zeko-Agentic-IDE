const SENSITIVE_CODEX_ENV = ["CODEX_API_KEY", "OPENAI_API_KEY", "CODEX_HOME"] as const;

/** Builds a process-only environment that cannot inherit credentials or a user-selected Codex home. */
export function buildCodexEnvironment(apiKey?: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...inherited };
  for (const key of SENSITIVE_CODEX_ENV) delete env[key];
  if (apiKey) env["CODEX_API_KEY"] = apiKey;
  return env;
}

export function codexSensitiveValues(apiKey?: string): string[] {
  return apiKey ? [apiKey] : [];
}
