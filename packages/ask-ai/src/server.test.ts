import { fakeText, type FakeResponseStep } from "@tanstack/ai/testing";
import type { TextOptions } from "@tanstack/ai";
import type { BoundTool } from "@pocket/tools/define-tool";
import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { AskAiBadRequestError, respondToAskAi, type AskAiEnvironment } from "./server";

const environment: AskAiEnvironment = {
  provider: "workers-ai",
  workersAi: { run: () => Promise.reject(new Error("not used")) },
};

function tool(overrides: Partial<BoundTool> & Pick<BoundTool, "name" | "execute">): BoundTool {
  return {
    label: "テスト",
    description: "テスト",
    effect: "read",
    idempotent: true,
    input: {},
    ...overrides,
  };
}

function requestBody(forwardedProps: object = {}) {
  return {
    threadId: "thread",
    runId: "run",
    messages: [{ id: "m1", role: "user", content: "教えて" }],
    tools: [],
    context: [],
    forwardedProps,
    state: {},
  };
}

function ask({
  body = requestBody(),
  tools,
  adapter,
}: {
  body?: unknown;
  tools: BoundTool[];
  adapter: ReturnType<typeof fakeText>;
}) {
  return respondToAskAi({
    body,
    tools,
    environment,
    signal: new AbortController().signal,
    adapter,
  });
}

function scripted(responses: FakeResponseStep[]) {
  const adapter = fakeText();
  adapter.setResponses(responses);
  return adapter;
}

function recordingAdapter(requests: TextOptions[], reply: { text: string }) {
  return scripted([
    ({ request }) => {
      requests.push(request);
      return reply;
    },
  ]);
}

describe("respondToAskAi", () => {
  it("runs a read tool without approval and streams the answer", async () => {
    const executed: unknown[] = [];
    const list = tool({
      name: "list",
      execute: (input) => {
        executed.push(input);
        return Promise.resolve({ count: 2 });
      },
    });
    const adapter = scripted([{ toolCalls: [{ name: "list", input: {} }] }, { text: "2件です" }]);
    const text = await (await ask({ tools: [list], adapter })).text();
    expect(executed).toEqual([{}]);
    expect(text).toContain("2件です");
  });

  it("holds a write tool until the user approves it", async () => {
    let executions = 0;
    const write = tool({
      name: "write",
      effect: "write",
      execute: () => {
        executions += 1;
        return Promise.resolve({ ok: true });
      },
    });
    const adapter = scripted([{ toolCalls: [{ name: "write", input: {} }] }]);
    const text = await (await ask({ tools: [write], adapter })).text();
    expect(executions).toBe(0);
    expect(text).toContain("tool-approval");
  });

  it("hides requestId from the model and generates one per write", async () => {
    const received: unknown[] = [];
    const reply = tool({
      name: "reply",
      input: { requestId: z.uuid(), body: z.string() },
      execute: (input) => {
        received.push(input);
        return Promise.resolve({ ok: true });
      },
    });
    const adapter = scripted([
      { toolCalls: [{ name: "reply", input: { body: "こんにちは" } }] },
      { text: "完了" },
    ]);
    await (await ask({ tools: [{ ...reply, effect: "read" }], adapter })).text();
    expect(received).toEqual([{ body: "こんにちは", requestId: expect.any(String) }]);
  });

  it("adds the page context from a read tool as data", async () => {
    const requests: TextOptions[] = [];
    const page = tool({
      name: "get_page",
      execute: () => Promise.resolve({ title: "見ている内容" }),
    });
    const adapter = recordingAdapter(requests, { text: "了解" });
    const body = requestBody({ page: { tool: "get_page", input: {} } });
    await (await ask({ body, tools: [page], adapter })).text();
    expect(JSON.stringify(requests[0]?.systemPrompts)).toContain("見ている内容");
  });

  it("does not run a write tool to build the page context", async () => {
    const requests: TextOptions[] = [];
    let executions = 0;
    const write = tool({
      name: "write",
      effect: "write",
      execute: () => {
        executions += 1;
        return Promise.resolve({ title: "漏れてはいけない" });
      },
    });
    const adapter = recordingAdapter(requests, { text: "了解" });
    const body = requestBody({ page: { tool: "write", input: {} } });
    await (await ask({ body, tools: [write], adapter })).text();
    expect(executions).toBe(0);
    expect(JSON.stringify(requests[0]?.systemPrompts)).not.toContain("漏れてはいけない");
  });

  it("rejects malformed and overlong conversations", async () => {
    const adapter = scripted([]);
    await expect(ask({ body: { messages: "x" }, tools: [], adapter })).rejects.toBeInstanceOf(
      AskAiBadRequestError,
    );
    const messages = Array.from({ length: 41 }, (_, index) => ({
      id: `m${index}`,
      role: "user",
      content: "x",
    }));
    await expect(
      ask({ body: { ...requestBody(), messages }, tools: [], adapter }),
    ).rejects.toBeInstanceOf(AskAiBadRequestError);
  });
});
