import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { createPhotoStore, PhotoRejectedError } from "@pocket/things/server";
import { ToolNotFoundError, type ToolCaller } from "@pocket/tools/define-tool";
import { z } from "zod";
import { bindAppTools } from "../app-tools";
import { handleMcp } from "../mcp/server";
import { boundedRequest } from "../security/bounded-request";
import { localAccessError } from "../security/local-access";
import { registerTokenRoutes } from "./tokens";

const defaultBodyLimit = 8192;
const photoBodyLimit = 2_500_000;
const photoCollectionPath = "/api/things/photos";

function bodyLimit(request: Request) {
  return request.method === "POST" && new URL(request.url).pathname === photoCollectionPath
    ? photoBodyLimit
    : defaultBodyLimit;
}

function mediaTypeOf(request: Request) {
  return request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
}

export type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  OWNER?: string;
  SESSION_OWNER?: string;
  POCKET_AUTH_ENABLED?: boolean;
};

export function createApi(development: boolean) {
  const app = new Hono<{ Bindings: Bindings }>();
  const toolsFor = (env: Bindings, caller: ToolCaller) =>
    bindAppTools({
      binding: env.DB,
      ownerId: development ? "local" : (env.OWNER ?? ""),
      caller,
    });
  app.use("*", secureHeaders());
  app.use("*", async (context, next) => {
    context.header("Cache-Control", "no-store");
    if (!development && context.env?.POCKET_AUTH_ENABLED !== true)
      return context.json({ error: "Authenticated access is not enabled." }, 503);
    const error = localAccessError(context.req.raw, development, !development);
    if (error !== null) return context.json({ error }, 403);
    if (!development && !context.env.OWNER)
      return context.json({ error: "Sign in required." }, 401);
    context.req.raw = await boundedRequest(context.req.raw, bodyLimit(context.req.raw));
    await next();
  });
  registerTokenRoutes(app);
  app.get("/api/access", (context) => context.json({ allowed: true }));
  app.post("/api/tools/:name", async (context) => {
    if (mediaTypeOf(context.req.raw) !== "application/json")
      return context.json({ error: "Expected application/json." }, 415);
    const name = context.req.param("name");
    const tool = toolsFor(context.env, "web").find((candidate) => candidate.name === name);
    if (tool === undefined) return context.json({ error: "Tool not found." }, 404);
    return context.json(await tool.execute(await context.req.json<unknown>()));
  });
  const photoStoreFor = (env: Bindings) =>
    createPhotoStore({
      binding: env.DB,
      storage: env.STORAGE,
      ownerId: development ? "local" : (env.OWNER ?? ""),
    });
  app.post(photoCollectionPath, async (context) => {
    if (mediaTypeOf(context.req.raw) !== "multipart/form-data")
      return context.json({ error: "Expected multipart/form-data." }, 415);
    const form = await context.req.raw.formData();
    return context.json({ photo: await photoStoreFor(context.env).save(form) }, 201);
  });
  app.get(`${photoCollectionPath}/:id/:variant`, async (context) => {
    const object = await photoStoreFor(context.env).open(context.req.param());
    context.header("Content-Type", "image/jpeg");
    context.header("Cache-Control", "private, max-age=31536000, immutable");
    return context.body(object.body);
  });
  for (const path of ["/mcp", "/api/mcp"]) {
    app.all(path, (context) => handleMcp(context.req.raw, toolsFor(context.env, "mcp")));
  }
  app.notFound((context) => context.json({ error: "Route not found." }, 404));
  app.onError((error, context) => {
    if (error instanceof ToolNotFoundError) return context.json({ error: error.message }, 404);
    if (error instanceof PhotoRejectedError) return context.json({ error: error.message }, 422);
    if (error instanceof z.ZodError) return context.json({ error: "Invalid input." }, 400);
    if (error instanceof SyntaxError) return context.json({ error: "Invalid JSON." }, 400);
    if (error instanceof HTTPException) return context.json({ error: error.message }, error.status);
    console.error(
      JSON.stringify({
        event: "api.request_failed",
        method: context.req.method,
        path: context.req.path,
      }),
    );
    return context.json({ error: "Internal server error." }, 500);
  });
  return app;
}
