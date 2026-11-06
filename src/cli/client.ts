import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Command } from "./arguments.ts";

export async function executeCommand(command: Command) {
  const deadline = AbortSignal.timeout(10_000);
  const transport = new StreamableHTTPClientTransport(new URL("http://127.0.0.1:5273/mcp"), {
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        redirect: "error",
        signal: init?.signal ? AbortSignal.any([deadline, init.signal]) : deadline,
      }),
    reconnectionOptions: {
      maxRetries: 0,
      maxReconnectionDelay: 0,
      initialReconnectionDelay: 0,
      reconnectionDelayGrowFactor: 1,
    },
  });
  const client = new Client({ name: "void-task-cli", version: "0.2.0" });
  const requestOptions = { timeout: 10_000, maxTotalTimeout: 10_000, signal: deadline };
  try {
    await client.connect(transport, requestOptions);
    if (command.kind === "list") {
      return await client.listTools(undefined, requestOptions);
    }
    const result = await client.callTool(
      { name: command.name, arguments: command.arguments },
      undefined,
      requestOptions,
    );
    if (result.isError) {
      throw new Error(JSON.stringify(result));
    }
    return result;
  } finally {
    await client.close();
    await transport.close();
  }
}
