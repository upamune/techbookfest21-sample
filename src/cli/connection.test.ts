import { describe, expect, it } from "vite-plus/test";
import { parseConnection } from "./connection";

describe("CLI connection", () => {
  const token = `vt1_${"a".repeat(64)}`;
  it("defaults to loopback without a credential", () => {
    expect(parseConnection({}).url.href).toBe("http://127.0.0.1:5273/mcp");
    expect(Array.from(parseConnection({}).headers)).toEqual([]);
  });
  it("requires explicit HTTPS destination and token together", () => {
    const remote = parseConnection({
      VOID_TASK_URL: "https://tasks.example.com/mcp",
      VOID_TASK_TOKEN: token,
    });
    expect(remote.url.href).toBe("https://tasks.example.com/mcp");
    expect(remote.headers.get("Authorization")).toBe(`Bearer ${token}`);
    expect(() => parseConnection({ VOID_TASK_TOKEN: token })).toThrow();
    expect(() => parseConnection({ VOID_TASK_URL: remote.url.href })).toThrow();
  });
  it("rejects insecure and ambiguous endpoints", () => {
    for (const url of [
      "http://tasks.example.com/mcp",
      "https://user:pass@tasks.example.com/mcp",
      "https://tasks.example.com/mcp?token=secret",
      "https://tasks.example.com/mcp#fragment",
      "https://tasks.example.com/other",
    ]) {
      expect(() => parseConnection({ VOID_TASK_URL: url, VOID_TASK_TOKEN: token })).toThrow();
    }
  });
});
