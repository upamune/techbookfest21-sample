import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { handleMcp } from "../mcp/server";
import { boundedRequest } from "../security/bounded-request";
import { localAccessError } from "../security/local-access";
import { completionInput, createTaskInput, taskIdInput } from "../tasks/contracts";
import { createTaskService } from "../tasks/service";

type Bindings = { DB: D1Database };

export function createApi(development: boolean) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use("*", secureHeaders());
  app.use("*", async (context, next) => {
    context.header("Cache-Control", "no-store");
    const error = localAccessError(context.req.raw, development);
    if (error !== null) return context.json({ error }, development ? 403 : 503);
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
  app.get("/api/tasks", async (context) => {
    const tasks = await createTaskService(context.env.DB).list();
    return context.json({ tasks });
  });
  app.post("/api/tasks", async (context) => {
    const input = createTaskInput.parse(await context.req.json<unknown>());
    const task = await createTaskService(context.env.DB).create(input);
    return context.json({ task }, 201);
  });
  app.patch("/api/tasks/:id", async (context) => {
    const { id } = taskIdInput.parse({ id: context.req.param("id") });
    const body = completionInput.parse(await context.req.json<unknown>());
    const task = await createTaskService(context.env.DB).setCompleted({ id, ...body });
    return task === null ? context.json({ error: "Task not found." }, 404) : context.json({ task });
  });
  app.delete("/api/tasks/:id", async (context) => {
    const input = taskIdInput.parse({ id: context.req.param("id") });
    const deleted = await createTaskService(context.env.DB).remove(input);
    return context.json({ deleted });
  });
  app.all("/api/mcp", (context) => handleMcp(context.req.raw, createTaskService(context.env.DB)));
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
