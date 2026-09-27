import { describe, expect, it } from "vitest";
import { createRedactor } from "../src/redactor.js";

describe("storage redactor", () => {
  it("redacts contract patterns recursively with typed markers", () => {
    const redactor = createRedactor();
    const result = redactor.redact({ line: "contact user@example.com with sk-ant-abcdefghijklmnop", nested: [{ text: "Authorization: Bearer secret-token-value" }] });
    expect(result).toEqual({ line: "contact [REDACTED:email] with [REDACTED:api_key]", nested: [{ text: "Authorization: Bearer [REDACTED:bearer_token]" }] });
  });

  it("redacts exact injected values even when they do not match a known pattern", () => {
    const redactor = createRedactor();
    const unregister = redactor.registerSensitiveValues(["synthetic-secret-42", "another-value"]);
    expect(redactor.redact({ text: "prefix synthetic-secret-42 suffix", stderr: "another-value" })).toEqual({ text: "prefix [REDACTED:api_key] suffix", stderr: "[REDACTED:api_key]" });
    unregister();
    expect(redactor.redactText("synthetic-secret-42")).toBe("synthetic-secret-42");
  });
});
