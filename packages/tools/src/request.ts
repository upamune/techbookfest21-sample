import { z } from "zod";

const errorResponse = z.strictObject({ error: z.string() });

export async function request<T>({
  path,
  schema,
  init,
  timeoutMs = 10_000,
}: {
  path: string;
  schema: z.ZodType<T>;
  init?: RequestInit;
  timeoutMs?: number;
}): Promise<T> {
  const deadline = new AbortController();
  const timer = setTimeout(() => {
    deadline.abort(new Error("通信がタイムアウトしました。更新して結果を確認してください。"));
  }, timeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal;
  try {
    const response = await fetch(path, { ...init, signal });
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = errorResponse.safeParse(body);
      throw new Error(parsed.success ? parsed.data.error : `Request failed (${response.status})`);
    }
    return schema.parse(body);
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function callTool<T>({
  name,
  input,
  schema,
  signal,
}: {
  name: string;
  input: unknown;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
}): Promise<T> {
  return request({
    path: `/api/tools/${name}`,
    schema,
    init: { ...jsonRequest({ method: "POST", body: input }), signal },
  });
}

export function jsonRequest({
  method,
  body,
}: {
  method: "POST" | "PATCH";
  body: unknown;
}): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
