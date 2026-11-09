import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/d1";
import { ToolConflictError, ToolNotFoundError } from "@pocket/tools/define-tool";
import { z } from "zod";
import {
  recentActivityOutput,
  replyEntrySchema,
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

type ActivityRow = { createdAt: string; id: string };

function activityCursor({ createdAt, id }: ActivityRow) {
  return `${createdAt}_${id}`;
}

function afterPosition(
  columns: { createdAt: AnySQLiteColumn; id: AnySQLiteColumn },
  after: string | undefined,
) {
  if (after === undefined) return undefined;
  const [createdAt = "", id = ""] = after.split("_");
  return or(
    gt(columns.createdAt, createdAt),
    and(eq(columns.createdAt, createdAt), gt(columns.id, id)),
  );
}

export function createForumService({ binding, ownerId }: { binding: D1Database; ownerId: string }) {
  const database = drizzle(binding);
  const {
    ownerId: _threadOwner,
    requestId: _threadRequest,
    ...threadColumns
  } = getTableColumns(forumThreads);
  const {
    ownerId: _replyOwner,
    requestId: _replyRequest,
    deletedAt: _replyDeleted,
    ...replyColumns
  } = getTableColumns(forumReplies);
  const ownedThread = (id: ThreadId) =>
    and(eq(forumThreads.id, id), eq(forumThreads.ownerId, ownerId));

  async function findThread(id: ThreadId) {
    const [row] = await database.select(threadColumns).from(forumThreads).where(ownedThread(id));
    if (row === undefined) throw new ToolNotFoundError(threadNotFound);
    return threadSchema.parse(row);
  }

  async function numberedReply(row: {
    id: string;
    threadId: string;
    createdAt: string;
    authorKind: AuthorKind;
    authorName: string;
    body: string;
  }) {
    const [position] = await database
      .select({ earlier: count() })
      .from(forumReplies)
      .where(
        and(
          eq(forumReplies.threadId, row.threadId),
          or(
            lt(forumReplies.createdAt, row.createdAt),
            and(eq(forumReplies.createdAt, row.createdAt), lte(forumReplies.id, row.id)),
          ),
        ),
      );
    return replySchema.parse({ ...row, kind: "posted", number: (position?.earlier ?? 0) + 1 });
  }

  return {
    async listThreads({ archived }: { archived: boolean }) {
      const lastActivityAt = sql<string>`max(${forumThreads.createdAt}, coalesce(max(${forumReplies.createdAt}), ''))`;
      const rows = await database
        .select({ ...threadColumns, replyCount: count(forumReplies.id), lastActivityAt })
        .from(forumThreads)
        .leftJoin(
          forumReplies,
          and(eq(forumReplies.threadId, forumThreads.id), isNull(forumReplies.deletedAt)),
        )
        .where(
          and(
            eq(forumThreads.ownerId, ownerId),
            archived ? isNotNull(forumThreads.archivedAt) : isNull(forumThreads.archivedAt),
          ),
        )
        .groupBy(forumThreads.id)
        .orderBy(desc(lastActivityAt), desc(forumThreads.id))
        .limit(threadLimit);
      return z.array(threadSummarySchema).parse(rows);
    },
    async listRecentActivity({ after, limit }: { after?: string; limit: number }) {
      const order = (columns: { createdAt: AnySQLiteColumn; id: AnySQLiteColumn }) =>
        after === undefined
          ? [desc(columns.createdAt), desc(columns.id)]
          : [asc(columns.createdAt), asc(columns.id)];
      const number = sql<number>`(select count(*) + 1 from ${forumReplies} as earlier where earlier.thread_id = ${forumReplies.threadId} and (earlier.created_at < ${forumReplies.createdAt} or (earlier.created_at = ${forumReplies.createdAt} and earlier.id <= ${forumReplies.id})))`;
      const visibleThreads = and(
        eq(forumThreads.ownerId, ownerId),
        isNull(forumThreads.archivedAt),
      );
      const [threads, replies] = await Promise.all([
        database
          .select({
            id: forumThreads.id,
            threadId: forumThreads.id,
            threadTitle: forumThreads.title,
            authorKind: forumThreads.authorKind,
            authorName: forumThreads.authorName,
            body: forumThreads.body,
            createdAt: forumThreads.createdAt,
          })
          .from(forumThreads)
          .where(and(visibleThreads, afterPosition(forumThreads, after)))
          .orderBy(...order(forumThreads))
          .limit(limit + 1),
        database
          .select({
            id: forumReplies.id,
            threadId: forumReplies.threadId,
            threadTitle: forumThreads.title,
            authorKind: forumReplies.authorKind,
            authorName: forumReplies.authorName,
            body: forumReplies.body,
            createdAt: forumReplies.createdAt,
            number,
          })
          .from(forumReplies)
          .innerJoin(forumThreads, eq(forumReplies.threadId, forumThreads.id))
          .where(
            and(visibleThreads, isNull(forumReplies.deletedAt), afterPosition(forumReplies, after)),
          )
          .orderBy(...order(forumReplies))
          .limit(limit + 1),
      ]);
      const merged = [
        ...threads.map(({ id: _id, ...row }) => ({
          ...row,
          kind: "thread" as const,
          number: 1,
          cursor: activityCursor({ createdAt: row.createdAt, id: _id }),
        })),
        ...replies.map((row) => ({
          ...row,
          kind: "reply" as const,
          cursor: activityCursor(row),
        })),
      ].sort((left, right) => (left.cursor < right.cursor ? -1 : 1));
      const page = after === undefined ? merged.slice(-limit) : merged.slice(0, limit);
      return recentActivityOutput.parse({
        activities: page,
        nextCursor: page.at(-1)?.cursor ?? after ?? null,
        hasMore: after !== undefined && merged.length > limit,
      });
    },
    async getThread(id: ThreadId) {
      const thread = await findThread(id);
      const number = sql<number>`row_number() over (order by ${forumReplies.createdAt}, ${forumReplies.id}) + 1`;
      const rows = await database
        .select({ ...replyColumns, number, deletedAt: forumReplies.deletedAt })
        .from(forumReplies)
        .where(eq(forumReplies.threadId, id))
        .orderBy(desc(forumReplies.createdAt), desc(forumReplies.id))
        .limit(replyLimit);
      const replies = [...rows]
        .reverse()
        .map(({ deletedAt, ...row }) =>
          deletedAt === null
            ? { ...row, kind: "posted" }
            : { kind: "deleted", id: row.id, number: row.number },
        );
      return { thread, replies: z.array(replyEntrySchema).parse(replies) };
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
      const thread = await findThread(fields.threadId);
      if (thread.archivedAt !== null)
        throw new ToolConflictError("アーカイブ済みのスレッドには返信できません。");
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
      if (inserted !== undefined) return numberedReply(inserted);
      const [existing] = await database
        .select(replyColumns)
        .from(forumReplies)
        .where(and(eq(forumReplies.ownerId, ownerId), eq(forumReplies.requestId, requestId)));
      if (existing === undefined) throw new ToolNotFoundError("返信が見つかりません。");
      return numberedReply(existing);
    },
    async setThreadArchived({ id, archived }: { id: ThreadId; archived: boolean }) {
      const rows = await database
        .update(forumThreads)
        .set({ archivedAt: archived ? new Date().toISOString() : null })
        .where(ownedThread(id))
        .returning({ id: forumThreads.id });
      if (rows.length === 0) throw new ToolNotFoundError(threadNotFound);
      return { archived };
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
