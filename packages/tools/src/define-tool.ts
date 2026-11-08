import { z } from "zod";

export type ToolEffect = "read" | "write" | "destructive";
export type ToolCaller = "web" | "mcp";

export class ToolNotFoundError extends Error {
  override readonly name = "ToolNotFoundError";
}

type ToolSpec<Shape extends z.ZodRawShape> = {
  name: string;
  description: string;
  effect: ToolEffect;
  idempotent: boolean;
  input: Shape;
};

export type Tool<Context> = ToolSpec<z.ZodRawShape> & {
  execute: (input: unknown, context: Context) => Promise<object>;
};

export type BoundTool = ToolSpec<z.ZodRawShape> & {
  execute: (input: unknown) => Promise<object>;
};

export type ToolEnvironment = {
  binding: D1Database;
  ownerId: string;
  caller: ToolCaller;
};

export function toolFactory<Context>() {
  return function defineTool<Shape extends z.ZodRawShape>({
    run,
    ...spec
  }: ToolSpec<Shape> & {
    run: (input: z.infer<z.ZodObject<Shape, z.core.$strict>>, context: Context) => Promise<object>;
  }): Tool<Context> {
    const schema = z.strictObject(spec.input);
    return {
      ...spec,
      execute: async (input, context) => run(schema.parse(input), context),
    };
  };
}

export function bindTools<Context>(tools: Tool<Context>[], context: Context): BoundTool[] {
  return tools.map((tool) => ({
    ...tool,
    execute: (input) => tool.execute(input, context),
  }));
}
