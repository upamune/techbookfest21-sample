import { z } from "zod";

const toolInput = z.record(z.string(), z.unknown());
const callArguments = z.union([
  z.tuple([z.literal("call"), z.string().min(1), z.string()]),
  z.tuple([z.literal("call"), z.string().min(1), z.string(), z.literal("--confirm")]),
]);

export type Command =
  | { kind: "list" }
  | { kind: "call"; name: string; arguments: z.infer<typeof toolInput>; confirmed: boolean };

const usage = "Usage: pocket list | pocket call <tool-name> '<JSON>' [--confirm]";

export function parseArguments(args: string[]): Command {
  if (args.length === 1 && args[0] === "list") return { kind: "list" };
  const parsed = callArguments.safeParse(args);
  if (!parsed.success) throw new Error(usage);
  const [, name, json, confirmation] = parsed.data;
  const input: unknown = JSON.parse(json);
  return {
    kind: "call",
    name,
    arguments: toolInput.parse(input),
    confirmed: confirmation === "--confirm",
  };
}

export function assertCallAllowed({
  name,
  readOnly,
  confirmed,
}: {
  name: string;
  readOnly: boolean | undefined;
  confirmed: boolean;
}) {
  if (readOnly !== true && !confirmed)
    throw new Error(`${name} changes data and requires --confirm.`);
}
