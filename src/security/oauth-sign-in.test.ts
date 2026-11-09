import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import configureAuth from "../../auth";

const origin = "https://pocket.example";
const authBase = `${origin}/api/auth`;
const tables = [
  "user",
  "session",
  "account",
  "verification",
  "jwks",
  "oauthClient",
  "oauthAccessToken",
  "oauthRefreshToken",
  "oauthConsent",
  "oauthClientAssertion",
  "oauthResource",
  "oauthClientResource",
];

function createAuth() {
  return betterAuth(
    configureAuth({
      defaults: {
        baseURL: origin,
        basePath: "/api/auth",
        secret: "test-secret-test-secret-test-secret-test",
        database: memoryAdapter(Object.fromEntries(tables.map((table) => [table, []]))),
        trustedOrigins: [origin],
      },
      env: {
        AUTH_GITHUB_CLIENT_ID: "test-client",
        AUTH_GITHUB_CLIENT_SECRET: "test-fixture",
        POCKET_ALLOWED_GITHUB_IDS: '["1"]',
      },
      dialect: "sqlite",
      request: new Request(origin),
    }),
  );
}

function stubGitHub(id: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.hostname === "github.com")
        return Response.json({ access_token: "token", token_type: "bearer", scope: "read:user" });
      if (url.pathname === "/user/emails")
        return Response.json([{ email: "someone@example.test", primary: true, verified: true }]);
      return Response.json({
        id,
        login: "someone",
        name: "Someone",
        email: "someone@example.test",
        avatar_url: "https://avatars.example/someone.png",
      });
    }),
  );
}

async function completeGitHubSignIn(githubId: number) {
  stubGitHub(githubId);
  const auth = createAuth();
  const started = await auth.handler(
    new Request(`${authBase}/sign-in/social`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ provider: "github", callbackURL: "/" }),
    }),
  );
  const { url } = z.object({ url: z.url() }).parse(await started.json());
  const state = new URL(url).searchParams.get("state") ?? "";
  const cookie = started.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return auth.handler(
    new Request(`${authBase}/callback/github?code=code&state=${state}`, { headers: { cookie } }),
  );
}

describe("completing a GitHub sign-in", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("signs in an allowed account", async () => {
    const response = await completeGitHubSignIn(1);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.getSetCookie().join()).toContain("session_token");
  });

  it("sends an account outside the allowlist back to sign-in without a session", async () => {
    const response = await completeGitHubSignIn(2);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?auth_error=account_not_permitted");
    expect(response.headers.getSetCookie().join()).not.toContain("session_token=");
  });
});
