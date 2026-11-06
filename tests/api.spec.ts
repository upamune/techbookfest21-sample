import { expect, test } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { taskResponse, tasksResponse, deletionResponse } from "../src/tasks/contracts";

function toolData(result: unknown): unknown {
  const envelope = z
    .object({ content: z.array(z.object({ type: z.literal("text"), text: z.string() })).min(1) })
    .parse(result);
  for (const item of envelope.content) return JSON.parse(item.text);
  throw new Error("MCP returned no content");
}

test("HTTP and MCP share persistent tasks and idempotent mutations", async ({ request }) => {
  const client = new Client({ name: "task-lab-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("http://127.0.0.1:5273/api/mcp")));
  let id: string | undefined;
  try {
    expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual([
      "create_task",
      "delete_task",
      "list_tasks",
      "set_task_completed",
    ]);
    const title = `日本語 ${crypto.randomUUID()}`;
    const created = await request.post("/api/tasks", { data: { title } });
    expect(created.status()).toBe(201);
    const { task } = taskResponse.parse(await created.json());
    id = task.id;
    expect(task.completed).toBe(false);
    expect(
      tasksResponse.parse(toolData(await client.callTool({ name: "list_tasks", arguments: {} })))
        .tasks,
    ).toContainEqual(task);
    for (let count = 0; count < 2; count += 1) {
      const updated = taskResponse.parse(
        toolData(
          await client.callTool({ name: "set_task_completed", arguments: { id, completed: true } }),
        ),
      );
      expect(updated.task.completed).toBe(true);
    }
    expect(
      tasksResponse.parse(await (await request.get("/api/tasks")).json()).tasks,
    ).toContainEqual({ ...task, completed: true });
    expect(
      deletionResponse.parse(
        toolData(await client.callTool({ name: "delete_task", arguments: { id } })),
      ).deleted,
    ).toBe(true);
    expect(
      deletionResponse.parse(await (await request.delete(`/api/tasks/${id}`)).json()).deleted,
    ).toBe(false);
    expect((await request.patch(`/api/tasks/${id}`, { data: { completed: false } })).status()).toBe(
      404,
    );
    expect(
      (await client.callTool({ name: "create_task", arguments: { title: " " } })).isError,
    ).toBe(true);
  } finally {
    if (id) await request.delete(`/api/tasks/${id}`);
    await client.close();
  }
});

test("input, origin and production boundaries fail closed", async ({ request }) => {
  for (const body of [{ title: " " }, { title: "x".repeat(201) }, { title: "ok", extra: true }]) {
    expect((await request.post("/api/tasks", { data: body })).status()).toBe(400);
  }
  expect(
    (
      await request.post("/api/tasks", {
        data: "{",
        headers: { "content-type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/tasks", { data: "hello", headers: { "content-type": "text/plain" } })
    ).status(),
  ).toBe(415);
  expect((await request.post("/api/tasks", { data: { title: "x".repeat(9000) } })).status()).toBe(
    413,
  );
  expect((await request.delete("/api/tasks/invalid")).status()).toBe(400);
  for (const path of ["/api/tasks", "/api/mcp"]) {
    expect(
      (await request.get(path, { headers: { origin: "https://untrusted.example" } })).status(),
    ).toBe(403);
    expect(
      (await request.get(path, { headers: { "sec-fetch-site": "cross-site" } })).status(),
    ).toBe(403);
    expect((await request.get(`http://127.0.0.1:4273${path}`)).status()).toBe(503);
  }
  const list = await request.get("/api/tasks");
  expect(list.headers()["cache-control"]).toBe("no-store");
});

test("SSR serves the application shell", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("次の一歩を、ひとつずつ。");
});
