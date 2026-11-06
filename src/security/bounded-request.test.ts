import { describe, expect, it } from "vite-plus/test";
import { boundedRequest } from "./bounded-request";

describe("bounded request bodies", () => {
  it("preserves exact boundary bytes and headers", async () => {
    const request = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "a".repeat(8192),
    });
    const result = await boundedRequest(request, 8192);
    expect(await result.text()).toHaveLength(8192);
    expect(result.headers.get("content-type")).toBe("application/json");
  });
  it("counts UTF-8 bytes rather than characters", async () => {
    const request = new Request("http://localhost/api/tasks", {
      method: "POST",
      body: "あ".repeat(3000),
    });
    await expect(boundedRequest(request, 8192)).rejects.toMatchObject({ status: 413 });
  });
  it("does not trust a smaller declared content length", async () => {
    const request = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "content-length": "1" },
      body: "a".repeat(8193),
    });
    await expect(boundedRequest(request, 8192)).rejects.toMatchObject({ status: 413 });
  });
  it("preserves requests without a body", async () => {
    const request = new Request("http://localhost/api/tasks");
    expect(await boundedRequest(request, 8192)).toBe(request);
  });
});
