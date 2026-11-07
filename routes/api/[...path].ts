import { defineHandler } from "void";
import { getUser } from "void/auth";
import { env } from "void/env";
import { createApi } from "../../src/http/api";
import { resolveAccessToken } from "../../src/security/access-tokens";
import { allowedOwner } from "../../src/security/allowed-owner";

const app = createApi(import.meta.env.DEV);
const handler = defineHandler(async (context) => {
  const user = getUser();
  const sessionOwner = user ? `user:${user.id}` : undefined;
  const hasBearer = context.req.raw.headers.has("authorization");
  const tokenOwner =
    hasBearer && env.TASK_AUTH_ENABLED
      ? await resolveAccessToken(context.env.DB, context.req.raw)
      : null;
  const principal = hasBearer ? (tokenOwner ?? undefined) : sessionOwner;
  const permittedOwner = env.TASK_AUTH_ENABLED
    ? await allowedOwner({
        binding: context.env.DB,
        owner: principal,
        githubIds: env.TASK_ALLOWED_GITHUB_IDS,
        googleSubs: env.TASK_ALLOWED_GOOGLE_SUBS,
      })
    : undefined;
  return app.fetch(context.req.raw, {
    DB: context.env.DB,
    TASK_AUTH_ENABLED: env.TASK_AUTH_ENABLED,
    TASK_OWNER: permittedOwner,
    SESSION_OWNER: hasBearer ? undefined : permittedOwner,
  });
});
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE, handler as OPTIONS };
