import { APIError } from "better-auth/api";
import { z } from "zod";
import { accountNotPermitted, authErrorParam } from "./auth-error";

export function rejectOAuthAccount(message: string): never {
  throw new APIError(
    "FOUND",
    { message },
    { Location: `/?${authErrorParam}=${accountNotPermitted}` },
  );
}

export function parseAllowedSubjects({
  value,
  schema,
}: {
  value: unknown;
  schema: z.ZodString;
}): ReadonlySet<string> {
  if (typeof value !== "string") return new Set();
  try {
    const decoded: unknown = JSON.parse(value);
    const parsed = z.array(schema).safeParse(decoded);
    return new Set(parsed.success ? parsed.data : []);
  } catch {
    return new Set();
  }
}
