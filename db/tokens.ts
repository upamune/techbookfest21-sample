import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accessTokens = sqliteTable(
  "access_tokens",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [index("access_tokens_owner").on(table.ownerId)],
);
