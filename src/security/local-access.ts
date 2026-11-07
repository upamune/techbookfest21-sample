const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function localAccessError(
  request: Request,
  development: boolean,
  authenticated = false,
): string | null {
  if (!development && !authenticated) return "API access is disabled outside local development.";
  const url = new URL(request.url);
  if (development && !loopbackHosts.has(url.hostname)) return "Only loopback access is allowed.";
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== url.origin) return "Cross-origin requests are forbidden.";
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return "Cross-site requests are forbidden.";
  return null;
}
