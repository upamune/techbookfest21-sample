import { defineHandler } from "void";
import { ai } from "void/ai";
import { getUser } from "void/auth";
import { env } from "void/env";
import { storage } from "void/storage";
import { createApi } from "../../src/http/api";
import { resolveAccessToken } from "../../src/security/access-tokens";
import { allowedOwner } from "../../src/security/allowed-owner";

const app = createApi(import.meta.env.DEV);
const handler = defineHandler(async (context) => {
  const user = getUser();
  const sessionOwner = user ? `user:${user.id}` : undefined;
  const hasBearer = context.req.raw.headers.has("authorization");
  const tokenOwner =
    hasBearer && env.POCKET_AUTH_ENABLED
      ? await resolveAccessToken(context.env.DB, context.req.raw)
      : null;
  const principal = hasBearer ? (tokenOwner ?? undefined) : sessionOwner;
  const permittedOwner = env.POCKET_AUTH_ENABLED
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
    POCKET_AUTH_ENABLED: env.POCKET_AUTH_ENABLED,
    OWNER: permittedOwner,
    SESSION_OWNER: hasBearer ? undefined : permittedOwner,
    ASK_AI: {
      provider: env.POCKET_AI_PROVIDER,
      model: env.POCKET_AI_MODEL,
      workersAi: ai,
      ollamaApiKey: env.OLLAMA_API_KEY,
      opencodeApiKey: env.OPENCODE_API_KEY,
      baseUrl: env.POCKET_AI_BASE_URL,
      apiKey: env.POCKET_AI_API_KEY,
    },
  });
});
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE, handler as OPTIONS };
