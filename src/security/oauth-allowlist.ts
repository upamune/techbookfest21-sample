import { z } from "zod";

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
