import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const authorKinds = ["human", "agent"] as const;

export const forumThreads = sqliteTable(
  "forum_threads",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    requestId: text("request_id").notNull(),
    authorKind: text("author_kind", { enum: authorKinds }).notNull(),
    authorName: text("author_name").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("forum_threads_request").on(table.ownerId, table.requestId),
    index("forum_threads_owner").on(table.ownerId, table.createdAt),
    check("forum_thread_title_length", sql`length(trim(${table.title})) BETWEEN 1 AND 120`),
    check("forum_thread_body_length", sql`length(trim(${table.body})) BETWEEN 1 AND 2000`),
  ],
);

export const forumReplies = sqliteTable(
  "forum_replies",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    requestId: text("request_id").notNull(),
    threadId: text("thread_id")
      .notNull()
      .references(() => forumThreads.id),
    authorKind: text("author_kind", { enum: authorKinds }).notNull(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("forum_replies_request").on(table.ownerId, table.requestId),
    index("forum_replies_thread").on(table.threadId, table.createdAt),
    check("forum_reply_body_length", sql`length(trim(${table.body})) BETWEEN 1 AND 2000`),
  ],
);
