import { z } from "zod";
import { parseAllowedGithubIds } from "./github-allowlist";
import { parseAllowedGoogleSubs } from "./google-allowlist";

const providerCredentials = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
});

type AuthSettings = {
  AUTH_GITHUB_CLIENT_ID?: unknown;
  AUTH_GITHUB_CLIENT_SECRET?: unknown;
  POCKET_ALLOWED_GITHUB_IDS?: unknown;
  AUTH_GOOGLE_CLIENT_ID?: unknown;
  AUTH_GOOGLE_CLIENT_SECRET?: unknown;
  POCKET_ALLOWED_GOOGLE_SUBS?: unknown;
};

function usableProvider(
  credentials: { clientId: unknown; clientSecret: unknown },
  allowlist: ReadonlySet<string>,
) {
  const parsed = providerCredentials.safeParse(credentials);
  return parsed.success && allowlist.size > 0 ? parsed.data : null;
}

export function configuredAuthProviders(env: AuthSettings) {
  return {
    github: usableProvider(
      { clientId: env.AUTH_GITHUB_CLIENT_ID, clientSecret: env.AUTH_GITHUB_CLIENT_SECRET },
      parseAllowedGithubIds(env.POCKET_ALLOWED_GITHUB_IDS),
    ),
    google: usableProvider(
      { clientId: env.AUTH_GOOGLE_CLIENT_ID, clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET },
      parseAllowedGoogleSubs(env.POCKET_ALLOWED_GOOGLE_SUBS),
    ),
  };
}

export function isAuthConfigured(env: AuthSettings) {
  const { github, google } = configuredAuthProviders(env);
  return github !== null || google !== null;
}
