import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const baseURL = "http://127.0.0.1:4281";
const resource = `${baseURL}/mcp`;
const issuer = `${baseURL}/api/auth`;
const redirectUri = "http://localhost:33418/callback";
const metadataDirectory = ".void/v3/d1/miniflare-D1DatabaseObject";
const allowedGithubId = "424242";
const mcpHeaders = { accept: "application/json, text/event-stream" };

const authorizationServer = z.object({
  issuer: z.string(),
  registration_endpoint: z.string(),
  client_id_metadata_document_supported: z.literal(true),
});

function authDatabase() {
  for (const file of readdirSync(metadataDirectory)) {
    if (!file.endsWith(".sqlite") || file === "metadata.sqlite") continue;
    const database = new DatabaseSync(join(metadataDirectory, file));
    if (database.prepare("select 1 from sqlite_master where name = 'oauthClient'").get())
      return database;
    database.close();
  }
  throw new Error("Auth tables were not found in the local database.");
}

function sessionCookie() {
  const secretLine = readFileSync(".env", "utf8")
    .split("\n")
    .find((line) => line.startsWith("BETTER_AUTH_SECRET="));
  const secret = secretLine?.slice("BETTER_AUTH_SECRET=".length) ?? "";
  const userId = `e2e-${randomUUID()}`;
  const token = randomBytes(24).toString("base64url");
  const now = Date.now();
  const database = authDatabase();
  database
    .prepare(
      "insert into user (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, 1, ?, ?)",
    )
    .run(userId, "E2E", `${userId}@example.test`, now, now);
  database
    .prepare(
      "insert into account (id, accountId, providerId, userId, createdAt, updatedAt) values (?, ?, 'github', ?, ?, ?)",
    )
    .run(randomUUID(), allowedGithubId, userId, now, now);
  database
    .prepare(
      "insert into session (id, token, userId, expiresAt, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), token, userId, now + 86_400_000, now, now);
  database.close();
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return {
    name: "better-auth.session_token",
    value: encodeURIComponent(`${token}.${signature}`),
    domain: "127.0.0.1",
    path: "/",
  };
}

async function registerClient(request: APIRequestContext) {
  const response = await request.post(`${issuer}/oauth2/register`, {
    data: {
      client_name: "E2E Client",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
  });
  expect(response.status()).toBe(201);
  return z.object({ client_id: z.string() }).parse(await response.json()).client_id;
}

function authorizationUrl(clientId: string) {
  const verifier = randomBytes(48).toString("base64url");
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "mcp:tools offline_access",
    state: "e2e-state",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource,
  });
  return { url: `${issuer}/oauth2/authorize?${query}`, verifier };
}

async function captureCallback(page: Page) {
  await page.route(`${redirectUri}**`, (route) => route.fulfill({ status: 200, body: "done" }));
  return page.waitForRequest((request) => request.url().startsWith(redirectUri));
}

function callTool(request: APIRequestContext, token: string) {
  return request.post("/mcp", {
    headers: { ...mcpHeaders, authorization: `Bearer ${token}` },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "forum_list_threads", arguments: {} },
    },
  });
}

test.beforeAll(() => {
  const database = authDatabase();
  database.exec("delete from jwks");
  database.close();
});

test("unauthenticated MCP requests lead clients to the authorization server", async ({
  request,
}) => {
  const denied = await request.post("/mcp", { headers: mcpHeaders, data: {} });
  expect(denied.status()).toBe(401);
  expect(denied.headers()["www-authenticate"]).toBe(
    `Bearer resource_metadata="${baseURL}/.well-known/oauth-protected-resource/mcp", scope="mcp:tools"`,
  );

  const metadata = await request.get("/.well-known/oauth-protected-resource/mcp");
  expect(await metadata.json()).toMatchObject({
    resource,
    authorization_servers: [issuer],
    scopes_supported: ["mcp:tools"],
  });

  const server = await request.get("/.well-known/oauth-authorization-server/api/auth");
  expect(authorizationServer.parse(await server.json()).issuer).toBe(issuer);
});

test("a person approves a client on their phone and MCP accepts its token", async ({
  page,
  context,
  request,
}) => {
  const clientId = await registerClient(request);
  await context.addCookies([sessionCookie()]);
  const { url, verifier } = authorizationUrl(clientId);

  await page.route("**/api/auth/oauth2/public-client**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.goto(url);
  const approve = page.getByRole("button", { name: "許可する" });
  await expect(approve).toBeDisabled();
  const loadingBox = await approve.boundingBox();
  await expect(page.getByRole("heading", { name: "E2E Client を接続しますか？" })).toBeVisible();
  await expect(page.getByText("未確認（名前はアプリの自己申告です）")).toBeVisible();
  await expect(page.getByText("localhost:33418")).toBeVisible();
  expect(await approve.boundingBox()).toEqual(loadingBox);
  expect(loadingBox?.height).toBeGreaterThanOrEqual(44);

  const callback = captureCallback(page);
  await approve.click();
  const code = new URL((await callback).url()).searchParams.get("code") ?? "";

  const tokenResponse = await request.post(`${issuer}/oauth2/token`, {
    form: {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource,
    },
  });
  expect(tokenResponse.status()).toBe(200);
  const { access_token: accessToken, refresh_token: refreshToken } = z
    .object({ access_token: z.string(), refresh_token: z.string() })
    .parse(await tokenResponse.json());

  const allowed = await callTool(request, accessToken);
  expect(allowed.status()).toBe(200);
  expect(await allowed.text()).toContain("threads");

  const tampered = await callTool(request, `${accessToken.slice(0, -3)}AAA`);
  expect(tampered.status()).toBe(401);
  expect(tampered.headers()["www-authenticate"]).toContain("resource_metadata");

  const rest = await request.post("/api/tools/forum_list_threads", {
    headers: { authorization: `Bearer ${accessToken}` },
    data: {},
  });
  expect(rest.status()).toBe(401);

  for (const path of ["**/api/oauth-connections", "**/api/tokens"]) {
    await page.route(path, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });
  }
  await page.goto("/settings");
  const connections = page.getByRole("region", { name: "接続中のアプリ" });
  const skeletonRow = connections.locator(".settings-row");
  await expect(skeletonRow).toHaveCount(1);
  const loadingRow = await skeletonRow.boundingBox();
  const tokens = page.getByRole("region", { name: "API・MCPアクセストークン" });
  const tokenRow = tokens.locator(".settings-row");
  const loadingTokenRow = await tokenRow.boundingBox();
  await expect(tokens.getByText("発行したトークンはありません。")).toBeVisible();
  expect(await tokenRow.boundingBox()).toEqual(loadingTokenRow);
  const disconnect = page.getByRole("button", { name: "E2E Client の接続を解除" });
  await expect(disconnect).toBeVisible();
  expect(await connections.locator(".settings-row").boundingBox()).toEqual(loadingRow);
  expect((await disconnect.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  const otherUser = await request.fetch(
    `/api/oauth-connections?${new URLSearchParams({ clientId })}`,
    {
      method: "DELETE",
      headers: {
        origin: baseURL,
        cookie: `better-auth.session_token=${sessionCookie().value}`,
      },
    },
  );
  expect(await otherUser.json()).toEqual({ revoked: false });
  expect((await callTool(request, accessToken)).status()).toBe(200);

  await disconnect.click();
  await expect(page.getByText("接続中のアプリはありません。")).toBeVisible();
  expect(await connections.locator(".settings-row").boundingBox()).toEqual(loadingRow);

  const revoked = await callTool(request, accessToken);
  expect(revoked.status()).toBe(401);
  const refreshed = await request.post(`${issuer}/oauth2/token`, {
    form: {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      resource,
    },
  });
  expect(refreshed.ok()).toBe(false);
});

test("denying a client returns an error to it", async ({ page, context, request }) => {
  const clientId = await registerClient(request);
  await context.addCookies([sessionCookie()]);
  await page.goto(authorizationUrl(clientId).url);
  const callback = captureCallback(page);
  await page.getByRole("button", { name: "拒否する" }).click();
  expect(new URL((await callback).url()).searchParams.get("error")).toBe("access_denied");
});

test("signing in during authorization keeps the signed request", async ({ page, request }) => {
  const clientId = await registerClient(request);
  await page.goto(authorizationUrl(clientId).url);
  await expect(page).toHaveURL(/\/oauth\/consent\?/u);
  await page.route("**/api/auth/sign-in/social", (route) => route.abort());
  const signIn = page.waitForRequest("**/api/auth/sign-in/social");
  await page.getByRole("button", { name: "GitHubでログイン" }).click();
  const body = z
    .object({ provider: z.literal("github"), oauth_query: z.string() })
    .parse((await signIn).postDataJSON());
  expect(new URLSearchParams(body.oauth_query).get("client_id")).toBe(clientId);
  expect(new URLSearchParams(body.oauth_query).has("sig")).toBe(true);
});

test("the signed-in person appears next to settings", async ({ page, context }) => {
  await context.addCookies([sessionCookie()]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings");
  await expect(
    page.getByRole("region", { name: "アカウント" }).getByText("E2E", { exact: true }),
  ).toBeVisible();
  const sidebar = page.locator(".app-sidebar");
  const name = await sidebar.getByText("E2E", { exact: true }).boundingBox();
  const settings = await sidebar.getByRole("link", { name: "設定" }).boundingBox();
  expect(settings?.y ?? 0).toBeGreaterThan(name?.y ?? 0);
  expect((settings?.y ?? 0) - (name?.y ?? 0)).toBeLessThan(60);
});

test("revoking a token asks first and uses a red button", async ({ page, context }) => {
  await context.addCookies([sessionCookie()]);
  await page.goto("/settings");
  const name = `e2e-${randomUUID()}`;
  await page.getByLabel("用途").fill(name);
  await page.getByRole("button", { name: "トークンを発行" }).click();
  await expect(page.getByLabel("発行されたトークン")).toBeVisible();
  const row = page.locator(".settings-row", { hasText: name });
  const revoke = row.getByRole("button", { name: `${name} を失効` });
  expect(await revoke.evaluate((button) => getComputedStyle(button).color)).toBe(
    "rgb(180, 35, 24)",
  );

  await revoke.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText(name)).toBeVisible();
  const cancel = dialog.getByRole("button", { name: "キャンセル" });
  await expect(cancel).toBeFocused();
  expect((await cancel.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await cancel.click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("有効");

  await revoke.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "失効する" }).click();
  await expect(row).toHaveCount(0);
});

test("a rejected account is told why on the sign-in screen", async ({ page }) => {
  await page.goto("/?auth_error=account_not_permitted");
  await expect(page.getByText("このアカウントにはアクセスが許可されていません。")).toBeVisible();
  await expect(page.getByRole("button", { name: "GitHubでログイン" })).toBeEnabled();
});

test("the consent page refuses a request without a signature", async ({ page, context }) => {
  await context.addCookies([sessionCookie()]);
  await page.goto(`/oauth/consent?client_id=x&redirect_uri=${encodeURIComponent(redirectUri)}`);
  await expect(page.getByText("接続の要求が無効か、期限が切れています。")).toBeVisible();
  await expect(page.getByRole("button", { name: "許可する" })).toHaveCount(0);
});
