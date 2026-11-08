import { describe, expect, it } from "vite-plus/test";
import { assertCallAllowed, parseArguments } from "../src/cli/arguments.ts";

describe("CLI argument boundaries", () => {
  it("lists tools without confirmation", () => {
    expect(parseArguments(["list"])).toEqual({ kind: "list" });
  });
  it("parses a tool call with its JSON input", () => {
    expect(parseArguments(["call", "forum_list_threads", "{}"])).toEqual({
      kind: "call",
      name: "forum_list_threads",
      arguments: {},
      confirmed: false,
    });
    expect(
      parseArguments(["call", "forum_add_reply", '{"body":"返信"}', "--confirm"]),
    ).toMatchObject({ arguments: { body: "返信" }, confirmed: true });
  });
  it.each([
    [[]],
    [["list", "--confirm"]],
    [["--url", "https://example.com/mcp", "list"]],
    [["call", "forum_list_threads"]],
    [["call", "forum_list_threads", "{}", "--token", "secret"]],
    [["call", "forum_list_threads", "{}", "--confirm", "--confirm"]],
    [["call", "forum_add_reply", "{}", "--confirm=true"]],
    [["call", "forum_list_threads", "{"]],
    [["call", "forum_list_threads", "null"]],
    [["call", "forum_list_threads", "[]"]],
  ])("rejects invalid CLI input %j", (args) => {
    expect(() => parseArguments(args)).toThrow();
  });
});

describe("CLI write confirmation", () => {
  it("allows read-only tools without confirmation", () => {
    expect(() =>
      assertCallAllowed({ name: "forum_list_threads", readOnly: true, confirmed: false }),
    ).not.toThrow();
  });
  it.each([false, undefined])("requires --confirm when readOnly is %s", (readOnly) => {
    expect(() =>
      assertCallAllowed({ name: "forum_add_reply", readOnly, confirmed: false }),
    ).toThrow("--confirm");
    expect(() =>
      assertCallAllowed({ name: "forum_add_reply", readOnly, confirmed: true }),
    ).not.toThrow();
  });
});
