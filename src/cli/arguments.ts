import { z } from "zod";
import { createTaskInput, setCompletedInput, taskIdInput } from "../tasks/contracts.ts";

const listCommand = z.strictObject({ kind: z.literal("list") });
const callCommand = z.discriminatedUnion("name", [
  z.strictObject({
    kind: z.literal("call"),
    name: z.literal("list_tasks"),
    arguments: z.strictObject({}),
    confirmed: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal("call"),
    name: z.literal("create_task"),
    arguments: createTaskInput,
    confirmed: z.literal(true),
  }),
  z.strictObject({
    kind: z.literal("call"),
    name: z.literal("set_task_completed"),
    arguments: setCompletedInput,
    confirmed: z.literal(true),
  }),
  z.strictObject({
    kind: z.literal("call"),
    name: z.literal("delete_task"),
    arguments: taskIdInput,
    confirmed: z.literal(true),
  }),
]);
const commandSchema = z.union([listCommand, callCommand]);
const callArguments = z.union([
  z.tuple([z.literal("call"), z.string(), z.string()]),
  z.tuple([z.literal("call"), z.string(), z.string(), z.literal("--confirm")]),
]);
export type Command = z.infer<typeof commandSchema>;

export function parseArguments(args: string[]): Command {
  if (args.length === 1 && args[0] === "list") {
    return { kind: "list" };
  }
  const parsed = callArguments.safeParse(args);
  if (!parsed.success) {
    throw new Error("Usage: tasks list | tasks call <tool-name> '<JSON>' [--confirm]");
  }
  const [, name, json, confirmation] = parsed.data;
  const input: unknown = JSON.parse(json);
  if (name !== "list_tasks" && confirmation !== "--confirm") {
    throw new Error("Tool calls other than list_tasks require --confirm.");
  }
  return commandSchema.parse({
    kind: "call",
    name,
    arguments: input,
    confirmed: confirmation === "--confirm",
  });
}
