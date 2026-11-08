import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { bindTools, toolFactory } from "./define-tool";

const tool = toolFactory<{ suffix: string }>();
const greet = tool({
  name: "greet",
  description: "挨拶する",
  effect: "read",
  idempotent: true,
  input: { name: z.string().trim().min(1) },
  run: async ({ name }, { suffix }) => ({ message: `${name}${suffix}` }),
});

describe("tool definitions", () => {
  it("binds the context and normalizes input through the shared schema", async () => {
    const [bound] = bindTools([greet], { suffix: "さん" });
    await expect(bound?.execute({ name: "  みちるだ " })).resolves.toEqual({
      message: "みちるださん",
    });
  });
  it("rejects unknown fields and invalid values", async () => {
    await expect(greet.execute({ name: "a", extra: 1 }, { suffix: "" })).rejects.toThrow();
    await expect(greet.execute({ name: " " }, { suffix: "" })).rejects.toThrow();
  });
});
