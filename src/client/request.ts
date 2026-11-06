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
  const response = await fetch(path, init);
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = errorResponse.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error : `Request failed (${response.status})`);
  }
  return schema.parse(body);
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
