import { parseArguments } from "../src/cli/arguments.ts";
import { executeCommand } from "../src/cli/client.ts";

try {
  const command = parseArguments(process.argv.slice(2));
  const result = await executeCommand(command);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "The MCP command failed.";
  process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  process.exitCode = 1;
}
