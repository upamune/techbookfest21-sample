import { defineHandler } from "void";
import { ai } from "void/ai";
import { getUser } from "void/auth";
import { env } from "void/env";
import { storage } from "void/storage";
import { createApi } from "../../src/http/api";
import { resolveAccessToken } from "../../src/security/access-tokens";
import { allowedOwner } from "../../src/security/allowed-owner";
import { isAuthConfigured } from "../../src/security/auth-config";
import { isMcpPath, resolveMcpOAuthOwner } from "../../src/security/mcp-oauth";
import { hasOAuthConsent } from "../../src/security/oauth-connections";
import { voidAuthHandler } from "../../src/security/void-auth";

const app = createApi(import.meta.env.DEV);

async function bearerOwner(context: Parameters<Parameters<typeof defineHandler>[0]>[0]) {
  const request = context.req.raw;
  const tokenOwner = await resolveAccessToken(context.env.DB, request);
  if (tokenOwner !== null || !isMcpPath(new URL(request.url).pathname)) return tokenOwner;
  return resolveMcpOAuthOwner({
    request,
    authHandler: voidAuthHandler(context),
    hasConsent: (consent) => hasOAuthConsent(context.env.DB, consent),
  });
}

const handler = defineHandler(async (context) => {
  const authConfigured = isAuthConfigured(env);
  const user = getUser();
  const sessionOwner = user ? `user:${user.id}` : undefined;
  const hasBearer = context.req.raw.headers.has("authorization");
  const tokenOwner = hasBearer && authConfigured ? await bearerOwner(context) : null;
  const principal = hasBearer ? (tokenOwner ?? undefined) : sessionOwner;
  const permittedOwner = authConfigured
    ? await allowedOwner({
        binding: context.env.DB,
        owner: principal,
        githubIds: env.POCKET_ALLOWED_GITHUB_IDS,
        googleSubs: env.POCKET_ALLOWED_GOOGLE_SUBS,
      })
    : undefined;
  return app.fetch(context.req.raw, {
    DB: context.env.DB,
    STORAGE: storage,
    IMAGES: context.env.IMAGES,
    AUTH_CONFIGURED: authConfigured,
    OWNER: permittedOwner,
    SESSION_OWNER: hasBearer ? undefined : permittedOwner,
    ASK_AI: {
      provider: env.POCKET_AI_PROVIDER,
      model: env.POCKET_AI_MODEL,
      workersAi: ai,
      ollamaApiKey: env.OLLAMA_API_KEY,
      baseUrl: env.POCKET_AI_BASE_URL,
      apiKey: env.POCKET_AI_API_KEY,
    },
  });
});
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE, handler as OPTIONS };
