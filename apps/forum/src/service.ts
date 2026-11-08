import { and, count, desc, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { ToolNotFoundError } from "@pocket/tools/define-tool";
import { z } from "zod";
import {
  replySchema,
  threadSchema,
  threadSummarySchema,
  type AuthorKind,
  type ReplyId,
  type ThreadId,
} from "./contracts";
import { forumReplies, forumThreads } from "./schema";

const replyLimit = 200;
const threadLimit = 100;
const threadNotFound = "スレッドが見つかりません。";

type Author = { authorKind: AuthorKind; authorName: string };
type CreateThread = Author & { requestId: string; title: string; body: string };
type AddReply = Author & { requestId: string; threadId: ThreadId; body: string };

export function createForumService({ binding, ownerId }: { binding: D1Database; ownerId: string }) {
  const database = drizzle(binding);
  const {
    ownerId: _threadOwner,
    requestId: _threadRequest,
    deletedAt: _threadDeleted,
    ...threadColumns
  } = getTableColumns(forumThreads);
  const {
    ownerId: _replyOwner,
    requestId: _replyRequest,
    deletedAt: _replyDeleted,
    ...replyColumns
  } = getTableColumns(forumReplies);
  const visibleThread = (id: ThreadId) =>
    and(eq(forumThreads.id, id), eq(forumThreads.ownerId, ownerId), isNull(forumThreads.deletedAt));

  async function findVisibleThread(id: ThreadId) {
    const [row] = await database.select(threadColumns).from(forumThreads).where(visibleThread(id));
    if (row === undefined) throw new ToolNotFoundError(threadNotFound);
    return threadSchema.parse(row);
  }

  return {
    async listThreads() {
      const lastActivityAt = sql<string>`max(${forumThreads.createdAt}, coalesce(max(${forumReplies.createdAt}), ''))`;
      const rows = await database
        .select({ ...threadColumns, replyCount: count(forumReplies.id), lastActivityAt })
        .from(forumThreads)
        .leftJoin(
          forumReplies,
          and(eq(forumReplies.threadId, forumThreads.id), isNull(forumReplies.deletedAt)),
        )
        .where(and(eq(forumThreads.ownerId, ownerId), isNull(forumThreads.deletedAt)))
        .groupBy(forumThreads.id)
        .orderBy(desc(lastActivityAt), desc(forumThreads.id))
        .limit(threadLimit);
      return z.array(threadSummarySchema).parse(rows);
    },
    async getThread(id: ThreadId) {
      const thread = await findVisibleThread(id);
      const rows = await database
        .select(replyColumns)
        .from(forumReplies)
        .where(and(eq(forumReplies.threadId, id), isNull(forumReplies.deletedAt)))
        .orderBy(desc(forumReplies.createdAt), desc(forumReplies.id))
        .limit(replyLimit);
      return { thread, replies: z.array(replySchema).parse([...rows].reverse()) };
    },
    async createThread({ requestId, ...fields }: CreateThread) {
      const [inserted] = await database
        .insert(forumThreads)
        .values({
          ...fields,
          id: crypto.randomUUID(),
          ownerId,
          requestId,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing({ target: [forumThreads.ownerId, forumThreads.requestId] })
        .returning(threadColumns);
      if (inserted !== undefined) return threadSchema.parse(inserted);
      const [existing] = await database
        .select(threadColumns)
        .from(forumThreads)
        .where(and(eq(forumThreads.ownerId, ownerId), eq(forumThreads.requestId, requestId)));
      return threadSchema.parse(existing);
    },
    async addReply({ requestId, ...fields }: AddReply) {
      await findVisibleThread(fields.threadId);
      const [inserted] = await database
        .insert(forumReplies)
        .values({
          ...fields,
          id: crypto.randomUUID(),
          ownerId,
          requestId,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing({ target: [forumReplies.ownerId, forumReplies.requestId] })
        .returning(replyColumns);
      if (inserted !== undefined) return replySchema.parse(inserted);
      const [existing] = await database
        .select(replyColumns)
        .from(forumReplies)
        .where(and(eq(forumReplies.ownerId, ownerId), eq(forumReplies.requestId, requestId)));
      return replySchema.parse(existing);
    },
    async setThreadDeleted({ id, deleted }: { id: ThreadId; deleted: boolean }) {
      const rows = await database
        .update(forumThreads)
        .set({ deletedAt: deleted ? new Date().toISOString() : null })
        .where(and(eq(forumThreads.id, id), eq(forumThreads.ownerId, ownerId)))
        .returning({ id: forumThreads.id });
      if (rows.length === 0) throw new ToolNotFoundError(threadNotFound);
      return { deleted };
    },
    async setReplyDeleted({ id, deleted }: { id: ReplyId; deleted: boolean }) {
      const rows = await database
        .update(forumReplies)
        .set({ deletedAt: deleted ? new Date().toISOString() : null })
        .where(and(eq(forumReplies.id, id), eq(forumReplies.ownerId, ownerId)))
        .returning({ id: forumReplies.id });
      if (rows.length === 0) throw new ToolNotFoundError("返信が見つかりません。");
      return { deleted };
    },
  };
}

export type ForumService = ReturnType<typeof createForumService>;
