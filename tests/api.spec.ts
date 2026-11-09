import { expect, test, type APIRequestContext } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { replyOutput, threadDetailOutput, threadOutput } from "@pocket/forum/contracts";
import { itemListOutput, itemOutput } from "@pocket/things/contracts";

const execute = promisify(execFile);
const expectedTools = [
  "forum_add_reply",
  "forum_create_thread",
  "forum_get_thread",
  "forum_list_recent_activity",
  "forum_list_threads",
  "forum_set_reply_deleted",
  "forum_set_thread_archived",
  "things_add_item",
  "things_list_options",
  "things_search_items",
  "things_set_item_deleted",
  "things_set_photo_deleted",
  "things_update_item",
];

async function runCli(args: string[]) {
  const env = { ...process.env };
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  const { stdout, stderr } = await execute(process.execPath, ["scripts/pocket.ts", ...args], {
    timeout: 15000,
    env,
  });
  expect(stderr).toBe("");
  const result: unknown = JSON.parse(stdout);
  return result;
}

function toolData(result: unknown): unknown {
  const envelope = z
    .object({ content: z.array(z.object({ type: z.literal("text"), text: z.string() })).min(1) })
    .parse(result);
  for (const item of envelope.content) return JSON.parse(item.text);
  throw new Error("MCP returned no content");
}

function callTool(request: APIRequestContext, name: string, input: object) {
  return request.post(`/api/tools/${name}`, { data: input });
}

async function connect(path = "/mcp") {
  const client = new Client({ name: "pocket-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:5273${path}`)));
  return client;
}

test("Web and MCP share forum data and separate human from agent authors", async ({ request }) => {
  const client = await connect();
  const title = `共有 ${crypto.randomUUID()}`;
  const created = await callTool(request, "forum_create_thread", {
    requestId: crypto.randomUUID(),
    authorName: "自分",
    title,
    body: "人が立てたスレッド",
  });
  expect(created.status()).toBe(200);
  const { thread } = threadOutput.parse(await created.json());
  try {
    expect(thread.authorKind).toBe("human");
    expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual(expectedTools);
    const requestId = crypto.randomUUID();
    const replies = [];
    for (let attempt = 0; attempt < 2; attempt += 1)
      replies.push(
        replyOutput.parse(
          toolData(
            await client.callTool({
              name: "forum_add_reply",
              arguments: { requestId, threadId: thread.id, authorName: "Claude", body: "AIの返信" },
            }),
          ),
        ).reply,
      );
    expect(replies[1]).toEqual(replies[0]);
    expect(replies[0]?.authorKind).toBe("agent");
    const detail = threadDetailOutput.parse(
      await (await callTool(request, "forum_get_thread", { id: thread.id })).json(),
    );
    expect(detail.replies).toEqual([replies[0]]);
    const invalid = await client.callTool({
      name: "forum_add_reply",
      arguments: { requestId, threadId: thread.id, authorName: "Claude", body: " " },
    });
    expect(invalid.isError).toBe(true);
    for (const authorName of [undefined, " "]) {
      const unnamed = await client.callTool({
        name: "forum_add_reply",
        arguments: {
          requestId: crypto.randomUUID(),
          threadId: thread.id,
          ...(authorName === undefined ? {} : { authorName }),
          body: "名乗らない返信",
        },
      });
      expect(unnamed.isError).toBe(true);
    }
    const absent = await client.callTool({
      name: "forum_get_thread",
      arguments: { id: crypto.randomUUID() },
    });
    expect(absent.isError).toBe(true);
  } finally {
    await callTool(request, "forum_set_thread_archived", { id: thread.id, archived: true });
    await client.close();
  }
});

test("Ask AI rejects malformed requests before calling a model", async ({ request }) => {
  const text = await request.post("/api/ai/chat", {
    data: "hello",
    headers: { "content-type": "text/plain" },
  });
  expect(text.status()).toBe(415);
  const invalid = await request.post("/api/ai/chat", { data: { messages: "x" } });
  expect(invalid.status()).toBe(400);
});

test("MCP tools advertise read and write effects", async () => {
  const client = await connect();
  try {
    const { tools } = await client.listTools();
    const hints = (name: string) => tools.find((tool) => tool.name === name)?.annotations;
    expect(hints("forum_list_threads")?.readOnlyHint).toBe(true);
    expect(hints("things_add_item")?.readOnlyHint).toBe(false);
    expect(hints("things_set_item_deleted")?.destructiveHint).toBe(true);
  } finally {
    await client.close();
  }
});

test("input, origin and production boundaries fail closed", async ({ request }) => {
  const path = "/api/tools/forum_create_thread";
  const valid = { requestId: crypto.randomUUID(), authorName: "自分", title: "題名", body: "本文" };
  for (const body of [
    { ...valid, title: " " },
    { ...valid, title: "x".repeat(121) },
    { ...valid, extra: true },
    { ...valid, requestId: "invalid" },
  ]) {
    expect((await request.post(path, { data: body })).status()).toBe(400);
  }
  expect(
    (
      await request.post(path, { data: "{", headers: { "content-type": "application/json" } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(path, { data: "hello", headers: { "content-type": "text/plain" } })
    ).status(),
  ).toBe(415);
  expect((await request.post(path, { data: { ...valid, body: "x".repeat(9000) } })).status()).toBe(
    413,
  );
  expect((await callTool(request, "create_task", {})).status()).toBe(404);
  for (const target of [path, "/mcp", "/api/mcp"]) {
    expect(
      (await request.get(target, { headers: { origin: "https://untrusted.example" } })).status(),
    ).toBe(403);
    expect(
      (await request.get(target, { headers: { "sec-fetch-site": "cross-site" } })).status(),
    ).toBe(403);
    expect((await request.get(`http://127.0.0.1:4273${target}`)).status()).toBe(503);
  }
  const list = await callTool(request, "forum_list_threads", {});
  expect(list.headers()["cache-control"]).toBe("no-store");
});

test("SSR serves the portal shell with mobile metadata", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("持ち物としまった場所を記録して");
  expect(html).toContain("viewport-fit=cover");
  expect(html).toContain('rel="manifest"');
  expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);
});

test("legacy MCP endpoint advertises the same tools", async () => {
  const client = await connect("/api/mcp");
  try {
    expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual(expectedTools);
  } finally {
    await client.close();
  }
});

test("CLI discovers app tools and requires confirmation for writes", async ({ request }) => {
  const tools = z
    .object({ tools: z.array(z.object({ name: z.string() })) })
    .parse(await runCli(["list"]));
  expect(tools.tools.map((tool) => tool.name).sort()).toEqual(expectedTools);
  const input = { requestId: crypto.randomUUID(), name: `CLI ${crypto.randomUUID()}` };
  await expect(
    execute(process.execPath, [
      "scripts/pocket.ts",
      "call",
      "things_add_item",
      JSON.stringify(input),
    ]),
  ).rejects.toMatchObject({ code: 1, stdout: "" });
  const { item } = itemOutput.parse(
    toolData(await runCli(["call", "things_add_item", JSON.stringify(input), "--confirm"])),
  );
  try {
    const search = await callTool(request, "things_search_items", { query: input.name });
    expect(itemListOutput.parse(await search.json()).items).toEqual([item]);
    expect(
      itemListOutput.parse(
        toolData(
          await runCli(["call", "things_search_items", JSON.stringify({ query: input.name })]),
        ),
      ).items,
    ).toEqual([item]);
    await expect(
      execute(process.execPath, ["scripts/pocket.ts", "call", "absent_tool", "{}", "--confirm"]),
    ).rejects.toMatchObject({ code: 1 });
  } finally {
    await callTool(request, "things_set_item_deleted", { id: item.id, deleted: true });
  }
});
