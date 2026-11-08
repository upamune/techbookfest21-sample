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
      POCKET_URL: "https://pocket.example.com/mcp",
      POCKET_TOKEN: token,
    });
    expect(remote.url.href).toBe("https://pocket.example.com/mcp");
    expect(remote.headers.get("Authorization")).toBe(`Bearer ${token}`);
    expect(() => parseConnection({ POCKET_TOKEN: token })).toThrow();
    expect(() => parseConnection({ POCKET_URL: remote.url.href })).toThrow();
  });
  it("rejects insecure and ambiguous endpoints", () => {
    for (const url of [
      "http://pocket.example.com/mcp",
      "https://user:pass@pocket.example.com/mcp",
      "https://pocket.example.com/mcp?token=secret",
      "https://pocket.example.com/mcp#fragment",
      "https://pocket.example.com/other",
    ]) {
      expect(() => parseConnection({ POCKET_URL: url, POCKET_TOKEN: token })).toThrow();
    }
  });
});
