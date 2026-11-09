import { defineHandler } from "void";
import { env } from "void/env";
import { isAuthConfigured } from "../../src/security/auth-config";
import { voidAuthHandler } from "../../src/security/void-auth";

export const GET = defineHandler((context) => {
  if (!isAuthConfigured(env)) return context.json({ error: "Route not found." }, 404);
  return voidAuthHandler(context)(context.req.raw);
});
