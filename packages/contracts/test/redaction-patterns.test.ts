import { describe, expect, it } from "vitest";
import { containsSensitiveData, findSensitiveData } from "../src/redaction-patterns.js";

describe("sensitive data patterns", () => {
  it.each([
    "sk-ant-1234567890abcdef1234567890",
    "sk-1234567890abcdef1234567890",
    "Authorization: Bearer abc.def_123-456",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature_123456",
    '{"id_token":"a-real-token-value"}',
    '{"access_token":"another-real-token"}',
    '{"refresh_token":"a-third-real-token"}',
    "tiago@example.com",
    '{"account_id":"acct_123456789"}',
  ])("detects sensitive values", (text) => expect(containsSensitiveData(text)).toBe(true));

  it.each([
    "The sk- prefix is mentioned in documentation.",
    "Authorization uses the Bearer authentication scheme.",
    "eyJ is an example JWT header prefix.",
    '{"tokens":["id_token","access_token","refresh_token","account_id"]}',
    '{"account_id":null}',
    "user@example is not a complete email address",
  ])("does not flag common non-secret text", (text) => expect(containsSensitiveData(text)).toBe(false));

  it("reports categories and positions without exposing surrounding content", () => {
    expect(findSensitiveData("contact tiago@example.com")).toMatchObject([{ kind: "email", value: "tiago@example.com", index: 8 }]);
  });
});
