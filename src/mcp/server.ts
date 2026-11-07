import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createTaskInput, setCompletedInput, taskIdInput } from "../tasks/contracts";
import type { TaskService } from "../tasks/service";

function toolResult(value: object, isError = false): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }], isError };
}

function createMcpServer(service: TaskService) {
  const server = new McpServer({ name: "void-task-lab", version: "0.2.0" });
  server.registerTool(
    "list_tasks",
    {
      description: "List up to 100 tasks, newest first.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => toolResult({ tasks: await service.list() }),
  );
  server.registerTool(
    "create_task",
    {
      description:
        "Create one task for the authenticated owner. Repeating a call creates another task.",
      inputSchema: createTaskInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => toolResult({ task: await service.create(createTaskInput.parse(input)) }),
  );
  server.registerTool(
    "set_task_completed",
    {
      description: "Set a task's completed state to the requested boolean.",
      inputSchema: setCompletedInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const task = await service.setCompleted(setCompletedInput.parse(input));
      return task === null ? toolResult({ error: "Task not found." }, true) : toolResult({ task });
    },
  );
  server.registerTool(
    "delete_task",
    {
      description: "Permanently delete one task. Deleted is false if it was already absent.",
      inputSchema: taskIdInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => toolResult({ deleted: await service.remove(taskIdInput.parse(input)) }),
  );
  return server;
}

export async function handleMcp(request: Request, service: TaskService): Promise<Response> {
  const server = createMcpServer(service);
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
