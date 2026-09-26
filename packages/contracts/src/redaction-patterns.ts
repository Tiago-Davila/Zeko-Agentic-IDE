export type SensitiveDataKind = "api_key" | "bearer_token" | "jwt" | "auth_token" | "email" | "account_id";

export interface SensitiveDataMatch {
  kind: SensitiveDataKind;
  value: string;
  index: number;
}

const SENSITIVE_PATTERNS: ReadonlyArray<{ kind: SensitiveDataKind; pattern: RegExp }> = [
  { kind: "api_key", pattern: /\bsk-(?:ant-)?[A-Za-z0-9_-]{12,}\b/g },
  { kind: "bearer_token", pattern: /\bAuthorization\s*:\s*Bearer\s+([A-Za-z0-9._~+/-]+=*)/gi },
  { kind: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { kind: "auth_token", pattern: /["']?(?:id_token|access_token|refresh_token)["']?\s*:\s*["']([^"'\s]{8,})["']/gi },
  { kind: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { kind: "account_id", pattern: /["']account_id["']\s*:\s*["']([^"'\s]{1,})["']/gi },
];

/** Finds credential values and personal identifiers without returning their containing text. */
export function findSensitiveData(text: string): SensitiveDataMatch[] {
  const matches: SensitiveDataMatch[] = [];
  for (const { kind, pattern } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = match[1] ?? match[0];
      const index = (match.index ?? 0) + (match[1] ? match[0].indexOf(value) : 0);
      matches.push({ kind, value, index });
    }
  }
  return matches.sort((left, right) => left.index - right.index || left.kind.localeCompare(right.kind));
}

export function containsSensitiveData(text: string): boolean {
  return findSensitiveData(text).length > 0;
}
