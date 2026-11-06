import { describe, expect, it } from "vite-plus/test";
import { createTaskInput, completionInput, taskIdInput, taskSchema } from "./contracts";

describe("task input boundary", () => {
  it("trims and preserves a Japanese title", () => {
    expect(createTaskInput.parse({ title: "  本のサンプルを検証  " })).toEqual({
      title: "本のサンプルを検証",
    });
  });
  it.each(["", " ", "x".repeat(201), 42, null])("rejects invalid title %s", (title) => {
    expect(createTaskInput.safeParse({ title }).success).toBe(false);
  });
  it("rejects extra create fields instead of letting callers set state", () => {
    expect(createTaskInput.safeParse({ title: "Sample", completed: true }).success).toBe(false);
  });
  it.each(["true", 1, null])("does not coerce completion %s", (completed) => {
    expect(completionInput.safeParse({ completed }).success).toBe(false);
  });
  it("requires a UUID task identifier", () => {
    expect(taskIdInput.safeParse({ id: "1 OR 1=1" }).success).toBe(false);
    expect(taskIdInput.safeParse({ id: crypto.randomUUID() }).success).toBe(true);
  });
  it("validates persisted or HTTP task timestamps", () => {
    expect(
      taskSchema.safeParse({
        id: crypto.randomUUID(),
        title: "Sample",
        completed: false,
        createdAt: "yesterday",
      }).success,
    ).toBe(false);
  });
});
