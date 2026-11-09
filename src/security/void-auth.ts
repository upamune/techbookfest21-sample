import { z } from "zod";

export type AuthHandler = (request: Request) => Promise<Response>;

const voidAuthInstance = z.object({
  handler: z.custom<AuthHandler>((value) => typeof value === "function"),
});

export function voidAuthHandler(context: { get: (key: "__voidAuth") => unknown }) {
  return voidAuthInstance.parse(context.get("__voidAuth")).handler;
}
