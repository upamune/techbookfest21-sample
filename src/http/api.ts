import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { handleMcp } from "../mcp/server";
import { boundedRequest } from "../security/bounded-request";
import { localAccessError } from "../security/local-access";
import { completionInput, createTaskInput, taskIdInput } from "../tasks/contracts";
import { createTaskService } from "../tasks/service";
import { registerTokenRoutes } from "./tokens";

export type Bindings = {
  DB: D1Database;
  TASK_OWNER?: string;
  SESSION_OWNER?: string;
  TASK_AUTH_ENABLED?: boolean;
};

export function createApi(development: boolean) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use("*", secureHeaders());
  app.use("*", async (context, next) => {
    context.header("Cache-Control", "no-store");
    if (!development && context.env?.TASK_AUTH_ENABLED !== true)
      return context.json({ error: "Authenticated access is not enabled." }, 503);
    const error = localAccessError(context.req.raw, development, !development);
    if (error !== null) return context.json({ error }, 403);
    if (!development && !context.env.TASK_OWNER)
      return context.json({ error: "Sign in required." }, 401);
    context.req.raw = await boundedRequest(context.req.raw, 8192);
    await next();
  });
  app.use("/api/tasks/*", async (context, next) => {
    if (["POST", "PATCH"].includes(context.req.method)) {
      const mediaType = context.req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
      if (mediaType !== "application/json")
        return context.json({ error: "Expected application/json." }, 415);
    }
    await next();
  });
  registerTokenRoutes(app);
  app.get("/api/access", (context) => context.json({ allowed: true }));
  app.get("/api/tasks", async (context) => {
    const tasks = await createTaskService(
      context.env.DB,
      development ? "local" : (context.env.TASK_OWNER ?? ""),
    ).list();
    return context.json({ tasks });
  });
  app.post("/api/tasks", async (context) => {
    const input = createTaskInput.parse(await context.req.json<unknown>());
    const task = await createTaskService(
      context.env.DB,
      development ? "local" : (context.env.TASK_OWNER ?? ""),
    ).create(input);
    return context.json({ task }, 201);
  });
  app.patch("/api/tasks/:id", async (context) => {
    const { id } = taskIdInput.parse({ id: context.req.param("id") });
    const body = completionInput.parse(await context.req.json<unknown>());
    const task = await createTaskService(
      context.env.DB,
      development ? "local" : (context.env.TASK_OWNER ?? ""),
    ).setCompleted({ id, ...body });
    return task === null ? context.json({ error: "Task not found." }, 404) : context.json({ task });
  });
  app.delete("/api/tasks/:id", async (context) => {
    const input = taskIdInput.parse({ id: context.req.param("id") });
    const deleted = await createTaskService(
      context.env.DB,
      development ? "local" : (context.env.TASK_OWNER ?? ""),
    ).remove(input);
    return context.json({ deleted });
  });
  for (const path of ["/mcp", "/api/mcp"]) {
    app.all(path, (context) =>
      handleMcp(
        context.req.raw,
        createTaskService(context.env.DB, development ? "local" : (context.env.TASK_OWNER ?? "")),
      ),
    );
  }
  app.notFound((context) => context.json({ error: "Route not found." }, 404));
  app.onError((error, context) => {
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
