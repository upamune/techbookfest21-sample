import { describe, expect, it } from "vite-plus/test";
import { parseArguments } from "../src/cli/arguments.ts";

const id = "0476526b-903a-4a74-8f68-6b85c587062c";

describe("CLI argument and confirmation boundaries", () => {
  it("lists tool definitions without confirmation", () => {
    expect(parseArguments(["list"])).toEqual({ kind: "list" });
  });
  it("allows only list_tasks without call confirmation", () => {
    expect(parseArguments(["call", "list_tasks", "{}"])).toEqual({
      kind: "call",
      name: "list_tasks",
      arguments: {},
      confirmed: false,
    });
  });
  it.each([
    ["create_task", { title: "Sample" }],
    ["set_task_completed", { id, completed: true }],
    ["delete_task", { id }],
  ])("requires explicit confirmation for %s", (name, input) => {
    expect(() => parseArguments(["call", name, JSON.stringify(input)])).toThrow("--confirm");
    expect(parseArguments(["call", name, JSON.stringify(input), "--confirm"])).toMatchObject({
      kind: "call",
      name,
      confirmed: true,
    });
  });
  it("uses the shared title validation and normalization", () => {
    expect(
      parseArguments(["call", "create_task", '{"title":"  本のサンプル  "}', "--confirm"]),
    ).toMatchObject({ arguments: { title: "本のサンプル" } });
  });
  it.each([
    [],
    ["list", "--confirm"],
    ["--url", "https://example.com/mcp", "list"],
    ["call", "list_tasks"],
    ["call", "list_tasks", "{}", "--token", "secret"],
    ["call", "list_tasks", "{}", "--confirm", "--confirm"],
    ["call", "create_task", '{"title":"Sample"}', "--confirm=true"],
    ["call", "unknown_tool", "{}", "--confirm"],
    ["call", "list_tasks", "{"],
    ["call", "list_tasks", "null"],
    ["call", "list_tasks", "[]"],
    ["call", "list_tasks", '{"unexpected":true}'],
    ["call", "create_task", '{"title":""}', "--confirm"],
    ["call", "create_task", '{"title":"Sample","completed":true}', "--confirm"],
    ["call", "delete_task", '{"id":"not-a-uuid"}', "--confirm"],
    ["call", "set_task_completed", JSON.stringify({ id, completed: "true" }), "--confirm"],
  ])("rejects invalid CLI input %j", (...args) => {
    expect(() => parseArguments(args)).toThrow();
  });
});
