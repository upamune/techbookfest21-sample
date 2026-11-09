import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  allowCimdDocument,
  createCimdFetch,
  mcpChallenge,
  parseCimdHosts,
  resolveMcpOAuthOwner,
} from "./mcp-oauth";

const origin = "https://pocket.example";
const issuer = `${origin}/api/auth`;
const audience = `${origin}/mcp`;

async function signer() {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid: "key-1", alg: "EdDSA" };
  const authHandler = async () => Response.json({ keys: [jwk] });
  return {
    authHandler,
    sign: ({
      claims = {},
      typ = "at+jwt",
      aud = audience,
      iss = issuer,
      expires = "1h",
    }: {
      claims?: Record<string, unknown>;
      typ?: string;
      aud?: string;
      iss?: string;
      expires?: string;
    }) =>
      new SignJWT({ azp: "client", scope: "mcp:tools", ...claims })
        .setProtectedHeader({ alg: "EdDSA", kid: "key-1", typ })
        .setSubject("alice")
        .setIssuer(iss)
        .setAudience(aud)
        .setIssuedAt()
        .setExpirationTime(expires)
        .sign(privateKey),
  };
}

function mcpRequest(token: string) {
  return new Request(audience, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("MCP OAuth access tokens", () => {
  it("maps a token bound to this resource to its owner", async () => {
    const { authHandler, sign } = await signer();
    const request = mcpRequest(await sign({}));
    await expect(resolveMcpOAuthOwner({ request, authHandler })).resolves.toBe("user:alice");
  });

  it.each([
    ["another resource", { aud: "https://other.example/mcp" }],
    ["another issuer", { iss: "https://other.example/api/auth" }],
    ["a session JWT", { typ: "JWT" }],
    ["an expired token", { expires: "-1m" }],
    ["a token without the tools scope", { claims: { scope: "openid" } }],
    ["a sender-constrained token", { claims: { cnf: { jkt: "thumbprint" } } }],
  ])("rejects %s", async (_label, options) => {
    const { authHandler, sign } = await signer();
    const request = mcpRequest(await sign(options));
    await expect(resolveMcpOAuthOwner({ request, authHandler })).resolves.toBeNull();
  });

  it("rejects a token signed by another key and a value that is not a JWT", async () => {
    const { authHandler } = await signer();
    const { sign } = await signer();
    await expect(
      resolveMcpOAuthOwner({ request: mcpRequest(await sign({})), authHandler }),
    ).resolves.toBeNull();
    await expect(
      resolveMcpOAuthOwner({ request: mcpRequest("not-a-jwt"), authHandler }),
    ).resolves.toBeNull();
  });

  it("reports an authorization server failure instead of asking for a new sign-in", async () => {
    const { sign } = await signer();
    const failure = new Error("database unavailable");
    await expect(
      resolveMcpOAuthOwner({
        request: mcpRequest(await sign({})),
        authHandler: () => Promise.reject(failure),
      }),
    ).rejects.toBe(failure);
  });

  it("points clients at the protected resource metadata", () => {
    expect(mcpChallenge(origin)).toBe(
      `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="mcp:tools"`,
    );
  });
});

describe("Client ID Metadata Document hosts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults to known clients and fails closed on an invalid setting", () => {
    expect(parseCimdHosts(undefined).has("claude.ai")).toBe(true);
    expect(parseCimdHosts('[" Client.Example "]')).toEqual(new Set(["client.example"]));
    expect(parseCimdHosts("not json")).toEqual(new Set());
    expect(parseCimdHosts('{"host":"client.example"}')).toEqual(new Set());
  });

  it("matches the exact host and records rejected hosts", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const hosts = new Set(["client.example"]);
    expect(allowCimdDocument("https://client.example/metadata.json", hosts)).toBe(true);
    expect(allowCimdDocument("https://evil.client.example/metadata.json", hosts)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("never follows redirects and refuses other hosts", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const fetchDocument = createCimdFetch(new Set(["client.example"]));
    await fetchDocument("https://client.example/metadata.json", { method: "GET" });
    expect(fetchMock).toHaveBeenCalledWith("https://client.example/metadata.json", {
      method: "GET",
      redirect: "manual",
    });
    expect(() => fetchDocument("https://internal.example/")).toThrow("CIMD host is not allowed.");
    expect(() => fetchDocument("http://client.example/")).toThrow("CIMD host is not allowed.");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
