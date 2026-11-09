import { verifyJwsAccessToken } from "better-auth/oauth2";
import { errors } from "jose";
import { z } from "zod";
import { parseAllowedSubjects } from "./oauth-allowlist";
import type { AuthHandler } from "./void-auth";

export const mcpToolsScope = "mcp:tools";
const defaultCimdHosts = '["claude.ai","chatgpt.com","openai.com"]';

const jsonWebKeySet = z.object({ keys: z.array(z.looseObject({ kty: z.string() })) });
const accessTokenClaims = z.object({
  sub: z.string().min(1),
  scope: z.string().default(""),
  cnf: z.object({ jkt: z.string() }).optional(),
});

export function isMcpPath(pathname: string) {
  return pathname === "/mcp" || pathname === "/api/mcp";
}

export function mcpResource(origin: string) {
  return `${origin}/mcp`;
}

export function mcpChallenge(origin: string) {
  const metadata = `${origin}/.well-known/oauth-protected-resource/mcp`;
  return `Bearer resource_metadata="${metadata}", scope="${mcpToolsScope}"`;
}

function isCredentialRejection(cause: unknown) {
  return cause instanceof errors.JOSEError || cause instanceof TypeError;
}

export async function resolveMcpOAuthOwner({
  request,
  authHandler,
}: {
  request: Request;
  authHandler: AuthHandler;
}) {
  const header = request.headers.get("authorization");
  if (header === null || !header.startsWith("Bearer ")) return null;
  const { origin } = new URL(request.url);
  const issuer = `${origin}/api/auth`;
  try {
    const verified = await verifyJwsAccessToken(header.slice(7), {
      jwksFetch: async () => {
        const response = await authHandler(new Request(`${issuer}/jwks`));
        return jsonWebKeySet.parse(await response.json());
      },
      verifyOptions: {
        issuer,
        audience: mcpResource(origin),
        typ: "at+jwt",
        requiredClaims: ["azp"],
      },
    });
    const claims = accessTokenClaims.parse(verified);
    if (claims.cnf !== undefined || !claims.scope.split(" ").includes(mcpToolsScope)) return null;
    return `user:${claims.sub}`;
  } catch (cause) {
    if (isCredentialRejection(cause) || cause instanceof z.ZodError) return null;
    throw cause;
  }
}

export function parseCimdHosts(value: unknown) {
  return parseAllowedSubjects({
    value: typeof value === "string" ? value : defaultCimdHosts,
    schema: z.string().trim().toLowerCase().min(1),
  });
}

function isAllowedCimdUrl(url: URL, hosts: ReadonlySet<string>) {
  return url.protocol === "https:" && hosts.has(url.hostname);
}

export function allowCimdDocument(clientId: string, hosts: ReadonlySet<string>) {
  const url = new URL(clientId);
  if (isAllowedCimdUrl(url, hosts)) return true;
  console.warn(JSON.stringify({ event: "mcp_oauth.cimd_host_rejected", host: url.hostname }));
  return false;
}

export function createCimdFetch(hosts: ReadonlySet<string>) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (!isAllowedCimdUrl(url, hosts)) throw new Error("CIMD host is not allowed.");
    return fetch(input, { ...init, redirect: "manual" });
  };
}
