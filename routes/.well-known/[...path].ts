import { defineHandler } from "void";
import { env } from "void/env";
import { voidAuthHandler } from "../../src/security/void-auth";

export const GET = defineHandler((context) => {
  if (!env.POCKET_AUTH_ENABLED) return context.json({ error: "Route not found." }, 404);
  return voidAuthHandler(context)(context.req.raw);
});
