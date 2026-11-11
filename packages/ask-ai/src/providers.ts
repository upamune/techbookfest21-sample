import type { AnyTextAdapter } from "@tanstack/ai";
import { createCloudflareText } from "@tanstack/ai-cloudflare";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";
import { z } from "zod";

export class AskAiUnavailableError extends Error {
  override readonly name = "AskAiUnavailableError";
}

type WorkersAiRun = (
  model: string,
  inputs: unknown,
  options: { returnRawResponse: true },
) => Promise<unknown>;

export type AskAiEnvironment = {
  provider: string;
  model?: string;
  workersAi: { run: WorkersAiRun };
  ollamaApiKey?: string;
  baseUrl?: string;
  apiKey?: string;
};

type ProviderRequest = { model: string; environment: AskAiEnvironment };
type AskAiProvider = {
  defaultModel?: string;
  createAdapter: (request: ProviderRequest) => AnyTextAdapter;
};

const workersAiRequest = z.looseObject({ model: z.string() });

function streamedFailure(message: string) {
  return new Response(`data: ${JSON.stringify({ error: { message } })}\n\n`, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

function workersAiFetch(workersAi: AskAiEnvironment["workersAi"]) {
  return async (_url: unknown, init?: RequestInit) => {
    const { model, ...inputs } = workersAiRequest.parse(
      JSON.parse(typeof init?.body === "string" ? init.body : "{}"),
    );
    let result: unknown;
    try {
      result = await workersAi.run(model, inputs, { returnRawResponse: true });
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("ai: Not available"))
        return streamedFailure(
          "Workers AI に接続できません。void connect --platform cloudflare を実行するか、別の接続先を設定してください。",
        );
      throw cause;
    }
    if (!(result instanceof Response)) throw new Error("Workers AI の応答を読み取れませんでした。");
    return result;
  };
}

function required(value: string | undefined, name: string) {
  if (!value) throw new AskAiUnavailableError(`${name} が設定されていません。`);
  return value;
}

const providers = {
  "workers-ai": {
    defaultModel: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
    createAdapter: ({ model, environment }) =>
      createCloudflareText(model, {
        accountId: "void-binding",
        apiKey: "void-binding",
        fetch: workersAiFetch(environment.workersAi),
      }),
  },
  "ollama-cloud": {
    defaultModel: "gpt-oss:120b",
    createAdapter: ({ model, environment }) =>
      openaiCompatibleText(model, {
        name: "ollama-cloud",
        baseURL: "https://ollama.com/v1",
        apiKey: required(environment.ollamaApiKey, "OLLAMA_API_KEY"),
      }),
  },
  "openai-compatible": {
    createAdapter: ({ model, environment }) =>
      openaiCompatibleText(model, {
        name: "openai-compatible",
        baseURL: required(environment.baseUrl, "POCKET_AI_BASE_URL"),
        apiKey: environment.apiKey || "not-needed",
      }),
  },
} satisfies Record<string, AskAiProvider>;

function isProviderId(id: string): id is keyof typeof providers {
  return Object.hasOwn(providers, id);
}

export function createAdapter({ environment }: { environment: AskAiEnvironment }): AnyTextAdapter {
  if (!isProviderId(environment.provider))
    throw new AskAiUnavailableError(`未対応の接続先です: ${environment.provider}`);
  const provider: AskAiProvider = providers[environment.provider];
  const model = required(environment.model || provider.defaultModel, "POCKET_AI_MODEL");
  return provider.createAdapter({ model, environment });
}
