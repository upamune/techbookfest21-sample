import { cimd } from "@better-auth/cimd";
import { mcp } from "@better-auth/mcp";
import { jwt } from "better-auth/plugins";
import { defineAuth } from "void/auth";
import { configuredAuthProviders } from "./src/security/auth-config";
import { authorizeGithubProfile, isAllowedGithubId } from "./src/security/github-allowlist";
import { authorizeGoogleProfile, isAllowedGoogleSub } from "./src/security/google-allowlist";
import {
  allowCimdDocument,
  createCimdFetch,
  mcpResource,
  mcpToolsScope,
  parseCimdHosts,
} from "./src/security/mcp-oauth";

const oauthPage = "/oauth/consent";

export default defineAuth(({ defaults, env, request }) => {
  const { github, google } = configuredAuthProviders(env);
  const enabled = github !== null || google !== null;
  const cimdHosts = parseCimdHosts(env.POCKET_CIMD_ALLOWED_HOSTS);
  return {
    ...defaults,
    disabledPaths: ["/token"],
    plugins: [
      jwt({ disableSettingJwtHeader: true }),
      mcp({
        loginPage: oauthPage,
        consentPage: oauthPage,
        resource: mcpResource(new URL(request.url).origin),
        scopes: ["openid", "offline_access", mcpToolsScope],
        clientRegistrationDefaultScopes: ["openid", mcpToolsScope, "offline_access"],
        clientRegistrationDefaultApplicationType: "infer",
        allowDynamicClientRegistration: enabled,
        allowUnauthenticatedClientRegistration: enabled,
      }),
      cimd({
        fetchClientMetadataResource: createCimdFetch(cimdHosts),
        metadataProfile: "mcp-2026-07-28",
        isMetadataDocumentUrlAllowed: (clientId) =>
          enabled && allowCimdDocument(clientId, cimdHosts),
      }),
    ],
    account: { ...defaults.account, accountLinking: { enabled: false } },
    databaseHooks: {
      ...defaults.databaseHooks,
      account: {
        create: {
          before: async (account) => {
            if (account.providerId === "github")
              return isAllowedGithubId({
                allowlist: env.POCKET_ALLOWED_GITHUB_IDS,
                id: account.accountId,
              });
            if (account.providerId === "google")
              return isAllowedGoogleSub({
                allowlist: env.POCKET_ALLOWED_GOOGLE_SUBS,
                sub: account.accountId,
              });
            return false;
          },
        },
      },
    },
    emailAndPassword: { enabled: false },
    socialProviders: {
      ...(github !== null
        ? {
            github: {
              ...github,
              mapProfileToUser: (profile: unknown) =>
                authorizeGithubProfile({ allowlist: env.POCKET_ALLOWED_GITHUB_IDS, profile }),
            },
          }
        : {}),
      ...(google !== null
        ? {
            google: {
              ...google,
              mapProfileToUser: (profile: unknown) =>
                authorizeGoogleProfile({ allowlist: env.POCKET_ALLOWED_GOOGLE_SUBS, profile }),
            },
          }
        : {}),
    },
  };
});
