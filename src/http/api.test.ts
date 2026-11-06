import { describe, expect, it } from "vite-plus/test";
import { createApi } from "./api";

const endpoint = "http://localhost/api/tasks";

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
      body: '{"title":"test"}',
    });
    expect(response.status).toBe(415);
  });
  it.each(["not json", '{"title":""}', '{"title":"test","extra":true}'])(
    "rejects invalid payload %s",
    async (body) => {
      const response = await createApi(true).request(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      expect(response.status).toBe(400);
    },
  );
  it("rejects malformed IDs before persistence", async () => {
    const response = await createApi(true).request(`${endpoint}/invalid`, { method: "DELETE" });
    expect(response.status).toBe(400);
  });
  it("rejects large bodies before parsing", async () => {
    const response = await createApi(true).request(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x".repeat(8192) }),
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
