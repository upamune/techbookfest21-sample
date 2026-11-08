import { z } from "zod";

const configuration = z.object({
  POCKET_URL: z.string().url().optional(),
  POCKET_TOKEN: z
    .string()
    .regex(/^vt1_[a-f0-9]{64}$/)
    .optional(),
});

export function parseConnection(environment: unknown) {
  const input = configuration.parse(environment);
  if (input.POCKET_URL === undefined && input.POCKET_TOKEN === undefined) {
    return { url: new URL("http://127.0.0.1:5273/mcp"), headers: new Headers() };
  }
  if (input.POCKET_URL === undefined || input.POCKET_TOKEN === undefined) {
    throw new Error("Remote access requires both POCKET_URL and POCKET_TOKEN.");
  }
  const url = remoteEndpoint(input.POCKET_URL);
  return { url, headers: new Headers({ Authorization: `Bearer ${input.POCKET_TOKEN}` }) };
}

function remoteEndpoint(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("POCKET_URL must be HTTPS without credentials, query, or fragment.");
  }
  if (url.pathname !== "/mcp") {
    throw new Error("POCKET_URL must point to the exact /mcp endpoint.");
  }
  return url;
}
