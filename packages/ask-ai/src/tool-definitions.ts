import { toolDefinition } from "@tanstack/ai";
import type { BoundTool } from "@pocket/tools/define-tool";
import { z } from "zod";

export type AskAiToolSpec = Pick<
  BoundTool,
  "name" | "label" | "fields" | "description" | "effect" | "input"
>;
export type AskAiToolDisplay = Pick<AskAiToolSpec, "label" | "fields">;

export function toolConfig({ name, description, input }: AskAiToolSpec) {
  const { requestId: _generatedOnServer, ...shape } = input;
  return { name, description, inputSchema: z.strictObject(shape) };
}

export function askAiClientTools(tools: AskAiToolSpec[]) {
  return {
    approvalTools: tools
      .filter((tool) => tool.effect !== "read")
      .map((tool) => toolDefinition({ ...toolConfig(tool), needsApproval: true })),
    display: Object.fromEntries(
      tools.map(({ name, label, fields }): [string, AskAiToolDisplay] => [name, { label, fields }]),
    ),
  };
}

export type AskAiClientTools = ReturnType<typeof askAiClientTools>;
