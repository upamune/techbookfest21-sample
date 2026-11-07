import { z } from "zod";
import { isAllowedGithubId } from "./github-allowlist";
import { isAllowedGoogleSub } from "./google-allowlist";

const linkedAccount = z.object({ accountId: z.string(), providerId: z.enum(["github", "google"]) });

export async function allowedOwner({
  binding,
  owner,
  githubIds,
  googleSubs,
}: {
  binding: D1Database;
  owner: string | undefined;
  githubIds: unknown;
  googleSubs: unknown;
}) {
  if (!owner?.startsWith("user:")) return undefined;
  const result = await binding
    .prepare(
      "SELECT accountId, providerId FROM account WHERE userId = ? AND providerId IN ('github', 'google')",
    )
    .bind(owner.slice(5))
    .all();
  const accounts = z.array(linkedAccount).parse(result.results);
  return accounts.some((account) =>
    account.providerId === "github"
      ? isAllowedGithubId({ allowlist: githubIds, id: account.accountId })
      : isAllowedGoogleSub({ allowlist: googleSubs, sub: account.accountId }),
  )
    ? owner
    : undefined;
}
