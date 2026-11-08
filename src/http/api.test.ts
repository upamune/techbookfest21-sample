import { describe, expect, it } from "vite-plus/test";
import { createApi } from "./api";

const endpoint = "http://localhost/api/tools/forum_create_thread";
const threadInput = {
  requestId: "0476526b-903a-4a74-8f68-6b85c587062c",
  authorName: "テスト",
  title: "題名",
};
const noBindings = {};

describe("HTTP boundary before database access", () => {
  it("fails closed in production and prevents caching", async () => {
    const response = await createApi(false).request(endpoint);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects cross-origin writes", async () => {
    const response = await createApi(true).request(endpoint, {
      method: "POST",
      headers: { origin: "https://example.com" },
    });
    expect(response.status).toBe(403);
  });
  it("requires JSON media type", async () => {
    const response = await createApi(true).request(endpoint, {
      method: "POST",
      body: JSON.stringify({ ...threadInput, body: "本文" }),
    });
    expect(response.status).toBe(415);
  });
  it.each([
    "not json",
    JSON.stringify({ ...threadInput, body: "" }),
    JSON.stringify({ ...threadInput, body: "本文", extra: true }),
    JSON.stringify({ ...threadInput, requestId: "not-a-uuid", body: "本文" }),
  ])("rejects invalid payload %s", async (body) => {
    const response = await createApi(true).request(
      endpoint,
      { method: "POST", headers: { "content-type": "application/json" }, body },
      noBindings,
    );
    expect(response.status).toBe(400);
  });
  it("rejects malformed IDs before persistence", async () => {
    const response = await createApi(true).request(
      "http://localhost/api/tools/forum_get_thread",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"id":"invalid"}',
      },
      noBindings,
    );
    expect(response.status).toBe(400);
  });
  it("returns 404 for an unknown tool", async () => {
    const response = await createApi(true).request(
      "http://localhost/api/tools/create_task",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      noBindings,
    );
    expect(response.status).toBe(404);
  });
  it("rejects large bodies before parsing", async () => {
    const response = await createApi(true).request(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...threadInput, body: "x".repeat(8192) }),
    });
    expect(response.status).toBe(413);
  });
  it.each(["/mcp", "/api/mcp"])("fails closed for %s in production", async (path) => {
    const response = await createApi(false).request(`http://localhost${path}`, { method: "POST" });
    expect(response.status).toBe(503);
  });
  it("returns a JSON route error", async () => {
    const response = await createApi(true).request("http://localhost/api/absent");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Route not found." });
  });
});

describe("authenticated production boundary", () => {
  it("does not let bearer principals issue more credentials", async () => {
    const response = await createApi(false).request(
      "https://pocket.example/api/tokens",
      {
        method: "POST",
        headers: { origin: "https://pocket.example", "content-type": "application/json" },
        body: '{"name":"forbidden"}',
      },
      { POCKET_AUTH_ENABLED: true, OWNER: "user:test" },
    );
    expect(response.status).toBe(401);
  });
  it("requires explicit same-origin token management", async () => {
    const response = await createApi(false).request(
      "https://pocket.example/api/tokens",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"name":"forbidden"}',
      },
      { POCKET_AUTH_ENABLED: true, OWNER: "user:test", SESSION_OWNER: "user:test" },
    );
    expect(response.status).toBe(403);
  });
  it("rejects anonymous access when explicitly enabled", async () => {
    const response = await createApi(false).request(endpoint, {}, { POCKET_AUTH_ENABLED: true });
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not trust client-supplied owner headers", async () => {
    const response = await createApi(false).request(
      endpoint,
      { headers: { OWNER: "user:victim", "x-user-id": "victim" } },
      { POCKET_AUTH_ENABLED: true },
    );
    expect(response.status).toBe(401);
  });
  it("rejects cross-origin authenticated requests", async () => {
    const response = await createApi(false).request(
      endpoint,
      { headers: { origin: "https://evil.example" } },
      { POCKET_AUTH_ENABLED: true, OWNER: "user:test" },
    );
    expect(response.status).toBe(403);
  });
  it("does not accept an authenticated principal while the gate is off", async () => {
    const response = await createApi(false).request(endpoint, {}, { OWNER: "user:test" });
    expect(response.status).toBe(503);
  });
});
