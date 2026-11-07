const tokenPattern = /^vt1_[a-f0-9]{64}$/;

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header === null || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  return tokenPattern.test(token) ? token : null;
}

export function generateTokenSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `vt1_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function hashTokenSecret(secret: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
