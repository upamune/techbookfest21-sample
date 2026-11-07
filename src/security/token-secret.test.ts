import { describe, expect, it } from "vite-plus/test";
import { generateTokenSecret, hashTokenSecret, readBearerToken } from "./token-secret";

describe("personal access token secrets", () => {
  it("generates unpredictable token-sized secrets and stores only a digest", async () => {
    const first = generateTokenSecret();
    const second = generateTokenSecret();
    expect(first).toMatch(/^vt1_[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
    expect(await hashTokenSecret(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashTokenSecret(first)).not.toBe(await hashTokenSecret(second));
  });
  it("accepts only the bearer token format", () => {
    const secret = generateTokenSecret();
    const request = (authorization: string) =>
      new Request("https://example.com/mcp", { headers: { authorization } });
    expect(readBearerToken(request(`Bearer ${secret}`))).toBe(secret);
    for (const value of [secret, "Basic secret", `Bearer ${secret} extra`, "Bearer vt1_short"]) {
      expect(readBearerToken(request(value))).toBeNull();
    }
    expect(readBearerToken(new Request("https://example.com/mcp"))).toBeNull();
  });
});
