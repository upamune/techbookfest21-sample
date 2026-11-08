import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import { request } from "./request";

const schema = z.strictObject({ ok: z.boolean() });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function stallFetch() {
  fetchMock.mockImplementation(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) throw new Error("Missing request signal");
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
  );
}

describe("browser request deadline", () => {
  it("aborts stalled mutations after ten seconds without retrying", async () => {
    stallFetch();
    const pending = request({
      path: "/api/tools/forum_list_threads/id",
      schema,
      init: { method: "DELETE" },
    });
    const rejected = expect(pending).rejects.toThrow("更新して結果を確認してください");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves caller cancellation and clears its deadline", async () => {
    stallFetch();
    const controller = new AbortController();
    const reason = new Error("Component unmounted");
    const pending = request({
      path: "/api/tools/forum_list_threads",
      schema,
      init: { signal: controller.signal },
    });
    const rejected = expect(pending).rejects.toBe(reason);
    controller.abort(reason);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("honors an already aborted caller signal", async () => {
    stallFetch();
    const reason = new Error("Already cancelled");
    await expect(
      request({
        path: "/api/tools/forum_list_threads",
        schema,
        init: { signal: AbortSignal.abort(reason) },
      }),
    ).rejects.toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds response body consumption as well as response headers", async () => {
    fetchMock.mockImplementation(
      async (_input, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason), {
                once: true,
              });
            },
          }),
        ),
    );
    const rejected = expect(
      request({ path: "/api/tools/forum_list_threads", schema }),
    ).rejects.toThrow("タイムアウト");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("validates successful data and clears the timer", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await expect(request({ path: "/api/tools/forum_list_threads", schema })).resolves.toEqual({
      ok: true,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves server errors and clears the timer", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Unavailable" }, { status: 503 }));
    await expect(request({ path: "/api/tools/forum_list_threads", schema })).rejects.toThrow(
      "Unavailable",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
