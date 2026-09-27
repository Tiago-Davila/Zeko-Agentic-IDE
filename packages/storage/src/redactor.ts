import { findSensitiveData, type SensitiveDataKind } from "@zeko/contracts";

declare const redactedBrand: unique symbol;
export type Redacted<T> = T & { readonly [redactedBrand]: true };

export interface Redactor {
  registerSensitiveValue(value: string, kind?: SensitiveDataKind): () => void;
  registerSensitiveValues(values: Iterable<string>, kind?: SensitiveDataKind): () => void;
  redact<T>(value: T): Redacted<T>;
  redactText(text: string): string;
}

const marker = (kind: SensitiveDataKind) => `[REDACTED:${kind}]`;

export function createRedactor(): Redactor {
  const sensitiveValues = new Map<string, SensitiveDataKind>();

  function redactText(text: string): string {
    const matches = findSensitiveData(text).map(({ kind, value, index }) => ({ kind, value, index }));
    // Exact injected values take precedence over heuristic patterns and are redacted wherever they occur.
    for (const [value, kind] of sensitiveValues) {
      let from = 0;
      while (value && (from = text.indexOf(value, from)) !== -1) {
        matches.push({ kind, value, index: from });
        from += value.length;
      }
    }
    const unique = new Map<string, { kind: SensitiveDataKind; value: string; index: number }>();
    for (const match of matches) unique.set(`${match.index}:${match.value.length}`, match);
    const sorted = [...unique.values()].sort((a, b) => b.index - a.index || b.value.length - a.value.length);
    let output = text;
    let protectedUntil = text.length;
    for (const match of sorted) {
      const end = match.index + match.value.length;
      if (end > protectedUntil) continue;
      output = `${output.slice(0, match.index)}${marker(match.kind)}${output.slice(end)}`;
      protectedUntil = match.index;
    }
    return output;
  }

  return {
    registerSensitiveValue(value, kind = "api_key") {
      if (!value) throw new Error("Sensitive values must not be empty");
      sensitiveValues.set(value, kind);
      return () => { sensitiveValues.delete(value); };
    },
    registerSensitiveValues(values, kind = "api_key") {
      const unregister = [...values].map((value) => this.registerSensitiveValue(value, kind));
      return () => unregister.forEach((remove) => remove());
    },
    redact<T>(value: T): Redacted<T> {
      const visit = (item: unknown): unknown => {
        if (typeof item === "string") return redactText(item);
        if (Array.isArray(item)) return item.map(visit);
        if (item && typeof item === "object") {
          return Object.fromEntries(Object.entries(item).map(([key, child]) => [redactText(key), visit(child)]));
        }
        return item;
      };
      return visit(value) as Redacted<T>;
    },
    redactText,
  };
}
