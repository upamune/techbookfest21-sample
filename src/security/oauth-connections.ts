import { z } from "zod";

const connectionRow = z.object({
  clientId: z.string(),
  name: z.string().nullable(),
  connectedAt: z.number(),
});

function userIdOf(ownerId: string) {
  return ownerId.slice("user:".length);
}

export async function hasOAuthConsent(
  binding: D1Database,
  { userId, clientId }: { userId: string; clientId: string },
) {
  const consent = await binding
    .prepare("SELECT 1 FROM oauthConsent WHERE userId = ? AND clientId = ? LIMIT 1")
    .bind(userId, clientId)
    .first();
  return consent !== null;
}

export function createOAuthConnectionService(binding: D1Database, ownerId: string) {
  const userId = userIdOf(ownerId);
  return {
    async list() {
      const { results } = await binding
        .prepare(
          "SELECT c.clientId AS clientId, client.name AS name, max(c.createdAt) AS connectedAt FROM oauthConsent c JOIN oauthClient client ON client.clientId = c.clientId WHERE c.userId = ? GROUP BY c.clientId ORDER BY connectedAt DESC LIMIT 100",
        )
        .bind(userId)
        .all();
      return z.array(connectionRow).parse(results);
    },
    async revoke(clientId: string) {
      const statements = ["oauthAccessToken", "oauthRefreshToken", "oauthConsent"].map((table) =>
        binding
          .prepare(`DELETE FROM ${table} WHERE userId = ? AND clientId = ?`)
          .bind(userId, clientId),
      );
      const results = await binding.batch(statements);
      return results.some((result) => result.meta.changes > 0);
    },
  };
}
