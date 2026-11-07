import { defineAuth } from "void/auth";
import { z } from "zod";
import { authorizeGithubProfile, isAllowedGithubId } from "./src/security/github-allowlist";
import { authorizeGoogleProfile, isAllowedGoogleSub } from "./src/security/google-allowlist";

const providerCredentials = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
});

export default defineAuth(({ defaults, env }) => {
  const enabled = env.TASK_AUTH_ENABLED === true || env.TASK_AUTH_ENABLED === "true";
  const github = providerCredentials.safeParse({
    clientId: env.AUTH_GITHUB_CLIENT_ID,
    clientSecret: env.AUTH_GITHUB_CLIENT_SECRET,
  });
  const google = providerCredentials.safeParse({
    clientId: env.AUTH_GOOGLE_CLIENT_ID,
    clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
  });
  return {
    ...defaults,
    account: { ...defaults.account, accountLinking: { enabled: false } },
    databaseHooks: {
      ...defaults.databaseHooks,
      account: {
        create: {
          before: async (account) => {
            if (account.providerId === "github")
              return isAllowedGithubId({
                allowlist: env.TASK_ALLOWED_GITHUB_IDS,
                id: account.accountId,
              });
            if (account.providerId === "google")
              return isAllowedGoogleSub({
                allowlist: env.TASK_ALLOWED_GOOGLE_SUBS,
                sub: account.accountId,
              });
            return false;
          },
        },
      },
    },
    emailAndPassword: { enabled: false },
    socialProviders: {
      ...(enabled && github.success
        ? {
            github: {
              ...github.data,
              mapProfileToUser: (profile: unknown) =>
                authorizeGithubProfile({ allowlist: env.TASK_ALLOWED_GITHUB_IDS, profile }),
            },
          }
        : {}),
      ...(enabled && google.success
        ? {
            google: {
              ...google.data,
              mapProfileToUser: (profile: unknown) =>
                authorizeGoogleProfile({ allowlist: env.TASK_ALLOWED_GOOGLE_SUBS, profile }),
            },
          }
        : {}),
    },
  };
});
