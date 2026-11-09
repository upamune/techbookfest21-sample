import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import configureAuth from "../../auth";
import { resolveMcpOAuthOwner } from "./mcp-oauth";

const origin = "https://pocket.example";
const issuer = `${origin}/api/auth`;
const resource = `${origin}/mcp`;
const clientId = "https://client.example/metadata.json";
const redirectUri = "https://client.example/callback";
const verifier = "e2e-verifier-e2e-verifier-e2e-verifier-e2e-verifier";

function createAuth(env: Record<string, unknown>) {
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
  const options = configureAuth({
    defaults: {
      baseURL: origin,
      basePath: "/api/auth",
      secret: "test-secret-test-secret-test-secret-test",
      database: memoryAdapter(Object.fromEntries(tables.map((table) => [table, []]))),
      trustedOrigins: [origin],
    },
    env,
    dialect: "sqlite",
    request: new Request(origin),
  });
  return betterAuth({
    ...options,
    emailAndPassword: { enabled: true },
    databaseHooks: {},
  });
}

async function signIn(auth: ReturnType<typeof createAuth>) {
  const { headers } = await auth.api.signUpEmail({
    body: { email: "owner@example.test", password: "test-password-123", name: "Owner" },
    returnHeaders: true,
  });
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function codeChallenge() {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function authorize(auth: ReturnType<typeof createAuth>, cookie: string) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "mcp:tools offline_access",
    state: "state-value",
    code_challenge: await codeChallenge(),
    code_challenge_method: "S256",
    resource,
  });
  return auth.handler(
    new Request(`${issuer}/oauth2/authorize?${query}`, {
      headers: { cookie, "sec-fetch-mode": "navigate" },
    }),
  );
}

function stubClientDocument() {
  const document = {
    client_id: clientId,
    client_name: "Example Client",
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
  const fetchMock = vi.fn(async () => Response.json(document));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("OAuth with a Client ID Metadata Document", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("issues a token the MCP endpoint accepts for an allowed client host", async () => {
    const fetchMock = stubClientDocument();
    const auth = createAuth({
      POCKET_AUTH_ENABLED: true,
      POCKET_CIMD_ALLOWED_HOSTS: '["client.example"]',
    });
    const cookie = await signIn(auth);

    const consentPage = await authorize(auth, cookie);
    expect(consentPage.status).toBe(302);
    const consentLocation = consentPage.headers.get("location") ?? "";
    expect(consentLocation).toMatch(/^\/oauth\/consent\?/u);
    expect(fetchMock).toHaveBeenCalled();

    const consent = await auth.handler(
      new Request(`${issuer}/oauth2/consent`, {
        method: "POST",
        headers: { cookie, origin, "content-type": "application/json" },
        body: JSON.stringify({ accept: true, oauth_query: consentLocation.split("?")[1] }),
      }),
    );
    const { url } = z.object({ url: z.url() }).parse(await consent.json());
    const code = new URL(url).searchParams.get("code") ?? "";

    const token = await auth.handler(
      new Request(`${issuer}/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          resource,
        }),
      }),
    );
    const { access_token: accessToken } = z
      .object({ access_token: z.string() })
      .parse(await token.json());

    const owner = await resolveMcpOAuthOwner({
      request: new Request(resource, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
      }),
      authHandler: auth.handler,
    });
    expect(owner).toMatch(/^user:/u);
  });

  it("does not fetch documents from hosts outside the allowlist", async () => {
    const fetchMock = stubClientDocument();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const auth = createAuth({
      POCKET_AUTH_ENABLED: true,
      POCKET_CIMD_ALLOWED_HOSTS: '["other.example"]',
    });
    const response = await authorize(auth, await signIn(auth));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps registration and document discovery closed while auth is disabled", async () => {
    const fetchMock = stubClientDocument();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const auth = createAuth({ POCKET_CIMD_ALLOWED_HOSTS: '["client.example"]' });
    const register = await auth.handler(
      new Request(`${issuer}/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          client_name: "Blocked",
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: "none",
        }),
      }),
    );
    expect(register.ok).toBe(false);
    const response = await authorize(auth, await signIn(auth));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
