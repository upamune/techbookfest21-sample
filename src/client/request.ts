import type { z } from "zod";

import { errorResponse } from "@/tasks/contracts";

export async function request<T>({
  path,
  schema,
  init,
}: {
  path: string;
  schema: z.ZodType<T>;
  init?: RequestInit;
}): Promise<T> {
  const deadline = new AbortController();
  const timer = setTimeout(() => {
    deadline.abort(new Error("通信がタイムアウトしました。更新して結果を確認してください。"));
  }, 10_000);
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

export function jsonRequest({
  method,
  body,
}: {
  method: "POST" | "PATCH";
  body: unknown;
}): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
