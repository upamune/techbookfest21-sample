import { z } from "zod";

const configuration = z.object({
  VOID_TASK_URL: z.string().url().optional(),
  VOID_TASK_TOKEN: z
    .string()
    .regex(/^vt1_[a-f0-9]{64}$/)
    .optional(),
});

export function parseConnection(environment: unknown) {
  const input = configuration.parse(environment);
  if (input.VOID_TASK_URL === undefined && input.VOID_TASK_TOKEN === undefined) {
    return { url: new URL("http://127.0.0.1:5273/mcp"), headers: new Headers() };
  }
  if (input.VOID_TASK_URL === undefined || input.VOID_TASK_TOKEN === undefined) {
    throw new Error("Remote access requires both VOID_TASK_URL and VOID_TASK_TOKEN.");
  }
  const url = remoteEndpoint(input.VOID_TASK_URL);
  return { url, headers: new Headers({ Authorization: `Bearer ${input.VOID_TASK_TOKEN}` }) };
}

function remoteEndpoint(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("VOID_TASK_URL must be HTTPS without credentials, query, or fragment.");
  }
  if (url.pathname !== "/mcp") {
    throw new Error("VOID_TASK_URL must point to the exact /mcp endpoint.");
  }
  return url;
}
