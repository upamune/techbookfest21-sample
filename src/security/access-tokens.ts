import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import { accessTokens } from "../../db/tokens";
import { generateTokenSecret, hashTokenSecret, readBearerToken } from "./token-secret";

export const tokenNameInput = z.strictObject({ name: z.string().trim().min(1).max(80) });

export async function resolveAccessToken(binding: D1Database, request: Request) {
  const secret = readBearerToken(request);
  if (secret === null) return null;
  const [token] = await drizzle(binding)
    .select({ ownerId: accessTokens.ownerId })
    .from(accessTokens)
    .where(
      and(
        eq(accessTokens.tokenHash, await hashTokenSecret(secret)),
        isNull(accessTokens.revokedAt),
        gt(accessTokens.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(1);
  if (!token || !token.ownerId.startsWith("user:")) return null;
  const user = await binding
    .prepare("SELECT id FROM user WHERE id = ?")
    .bind(token.ownerId.slice(5))
    .first();
  return user === null ? null : token.ownerId;
}

export function createTokenService(binding: D1Database, ownerId: string) {
  const database = drizzle(binding);
  return {
    async list() {
      return database
        .select({
          id: accessTokens.id,
          name: accessTokens.name,
          createdAt: accessTokens.createdAt,
          expiresAt: accessTokens.expiresAt,
          revokedAt: accessTokens.revokedAt,
        })
        .from(accessTokens)
        .where(
          and(
            eq(accessTokens.ownerId, ownerId),
            isNull(accessTokens.revokedAt),
            gt(accessTokens.expiresAt, new Date().toISOString()),
          ),
        )
        .orderBy(desc(accessTokens.createdAt))
        .limit(100);
    },
    async issue(input: z.infer<typeof tokenNameInput>) {
      const secret = generateTokenSecret();
      const now = Date.now();
      const token = {
        id: crypto.randomUUID(),
        name: input.name,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const result = await binding
        .prepare(
          "INSERT INTO access_tokens (id, owner_id, name, token_hash, created_at, expires_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM access_tokens WHERE owner_id = ? AND revoked_at IS NULL AND expires_at > ?) < 100",
        )
        .bind(
          token.id,
          ownerId,
          token.name,
          await hashTokenSecret(secret),
          token.createdAt,
          token.expiresAt,
          ownerId,
          token.createdAt,
        )
        .run();
      if (result.meta.changes !== 1)
        throw new Error("Revoke an existing active token before creating another.");
      return { ...token, secret };
    },
    async revoke(id: string) {
      const rows = await database
        .update(accessTokens)
        .set({ revokedAt: new Date().toISOString() })
        .where(and(eq(accessTokens.id, id), eq(accessTokens.ownerId, ownerId)))
        .returning({ id: accessTokens.id });
      return rows.length > 0;
    },
  };
}
