import { z } from "zod";
import { parseAllowedSubjects } from "./oauth-allowlist";

const githubId = z.string().regex(/^[1-9]\d*$/);
const githubProfile = z.object({
  id: z.union([githubId, z.number().int().positive().max(Number.MAX_SAFE_INTEGER)]),
});

export function parseAllowedGithubIds(value: unknown): ReadonlySet<string> {
  return parseAllowedSubjects({ value, schema: githubId });
}

export function isAllowedGithubId({ allowlist, id }: { allowlist: unknown; id: unknown }) {
  const parsed = githubProfile.safeParse({ id });
  return parsed.success && parseAllowedGithubIds(allowlist).has(String(parsed.data.id));
}

export function authorizeGithubProfile({
  allowlist,
  profile,
}: {
  allowlist: unknown;
  profile: unknown;
}) {
  const parsed = githubProfile.safeParse(profile);
  if (!parsed.success || !isAllowedGithubId({ allowlist, id: parsed.data.id }))
    throw new Error("GitHub account is not permitted.");
  return {};
}
