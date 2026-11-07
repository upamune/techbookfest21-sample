import { z } from "zod";
import { parseAllowedSubjects } from "./oauth-allowlist";

const googleSub = z.string().regex(/^[\x21-\x7e]{1,255}$/);
const googleProfile = z.object({ sub: googleSub });

export function parseAllowedGoogleSubs(value: unknown) {
  return parseAllowedSubjects({ value, schema: googleSub });
}

export function isAllowedGoogleSub({ allowlist, sub }: { allowlist: unknown; sub: unknown }) {
  const parsed = googleSub.safeParse(sub);
  return parsed.success && parseAllowedGoogleSubs(allowlist).has(parsed.data);
}

export function authorizeGoogleProfile({
  allowlist,
  profile,
}: {
  allowlist: unknown;
  profile: unknown;
}) {
  const parsed = googleProfile.safeParse(profile);
  if (!parsed.success || !isAllowedGoogleSub({ allowlist, sub: parsed.data.sub }))
    throw new Error("Google account is not permitted.");
  return {};
}
