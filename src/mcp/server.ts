import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ToolConflictError, ToolNotFoundError, type BoundTool } from "@pocket/tools/define-tool";
import { z } from "zod";

function toolResult(value: object, isError = false): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }], isError };
}

function failureResult(cause: unknown): CallToolResult {
  if (cause instanceof ToolNotFoundError || cause instanceof ToolConflictError)
    return toolResult({ error: cause.message }, true);
  if (cause instanceof z.ZodError) return toolResult({ error: "Invalid input." }, true);
  throw cause;
}

function createMcpServer(tools: BoundTool[]) {
  const server = new McpServer({ name: "pocket", version: "0.3.0" });
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.input,
        annotations: {
          readOnlyHint: tool.effect === "read",
          destructiveHint: tool.effect === "destructive",
          idempotentHint: tool.idempotent,
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          return toolResult(await tool.execute(input));
        } catch (cause) {
          return failureResult(cause);
        }
      },
    );
  }
  return server;
}

export async function handleMcp(request: Request, tools: BoundTool[]): Promise<Response> {
  const server = createMcpServer(tools);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
