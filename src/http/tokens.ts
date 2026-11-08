import type { Hono } from "hono";
import { z } from "zod";
import { createTokenService, tokenNameInput } from "../security/access-tokens";
import type { Bindings } from "./api";

export function registerTokenRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.use("/api/tokens/*", async (context, next) => {
    if (context.env?.POCKET_AUTH_ENABLED !== true || !context.env.SESSION_OWNER)
      return context.json({ error: "A browser sign-in is required to manage tokens." }, 401);
    if (
      context.req.method !== "GET" &&
      context.req.header("origin") !== new URL(context.req.url).origin
    )
      return context.json({ error: "Same-origin browser action required." }, 403);
    if (
      context.req.method === "POST" &&
      context.req.header("content-type")?.split(";")[0] !== "application/json"
    )
      return context.json({ error: "Expected application/json." }, 415);
    await next();
  });
  app.get("/api/tokens", async (context) => {
    const service = createTokenService(context.env.DB, context.env.SESSION_OWNER ?? "");
    return context.json({ tokens: await service.list() });
  });
  app.post("/api/tokens", async (context) => {
    const input = tokenNameInput.parse(await context.req.json<unknown>());
    const service = createTokenService(context.env.DB, context.env.SESSION_OWNER ?? "");
    return context.json({ token: await service.issue(input) }, 201);
  });
  app.delete("/api/tokens/:id", async (context) => {
    const id = z.string().uuid().parse(context.req.param("id"));
    const service = createTokenService(context.env.DB, context.env.SESSION_OWNER ?? "");
    return context.json({ revoked: await service.revoke(id) });
  });
}
