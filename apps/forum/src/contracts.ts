import { z } from "zod";

export const threadId = z.uuid().brand<"ThreadId">();
const replyId = z.uuid().brand<"ReplyId">();
const requestId = z
  .uuid()
  .describe("書き込みごとに生成するUUID。結果が不明で再送するときは同じ値を使う");
const authorName = z.string().trim().min(1).max(40);
const title = z.string().trim().min(1).max(120);
const body = z.string().trim().min(1).max(2000);

const authorKind = z.enum(["human", "agent"]);
export type AuthorKind = z.infer<typeof authorKind>;

const post = z.strictObject({
  id: z.uuid(),
  authorKind,
  authorName,
  body,
  createdAt: z.iso.datetime(),
});

export const threadSchema = post.extend({
  id: threadId,
  title,
  archivedAt: z.iso.datetime().nullable(),
});
export const threadSummarySchema = threadSchema.extend({
  replyCount: z.number().int().nonnegative(),
  lastActivityAt: z.iso.datetime(),
});
const replyNumber = z.number().int().min(2);
export const replySchema = post.extend({
  kind: z.literal("posted"),
  id: replyId,
  threadId,
  number: replyNumber,
});
const deletedReplySchema = z.strictObject({
  kind: z.literal("deleted"),
  id: replyId,
  number: replyNumber,
});
export const replyEntrySchema = z.discriminatedUnion("kind", [replySchema, deletedReplySchema]);

export const createThreadInput = { requestId, authorName, title, body };
export const addReplyInput = { requestId, threadId, authorName, body };
export const listThreadsInput = {
  archived: z.boolean().default(false).describe("trueならアーカイブ済みのスレッドだけを返す"),
};
const activityCursor = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z_[0-9a-f-]{36}$/u)
  .describe("前回の結果のnextCursor。省略すると最新の投稿だけを返す");
export const listRecentActivityInput = {
  after: activityCursor.optional(),
  limit: z.number().int().min(1).max(50).default(20),
};
export const getThreadInput = { id: threadId };
export const setThreadArchivedInput = { id: threadId, archived: z.boolean() };
export const setReplyDeletedInput = { id: replyId, deleted: z.boolean() };

export const threadListOutput = z.strictObject({ threads: z.array(threadSummarySchema) });
const activityBase = z.strictObject({
  threadId,
  threadTitle: title,
  number: z.number().int().min(1),
  authorKind,
  authorName,
  body,
  createdAt: z.iso.datetime(),
  cursor: activityCursor,
});
const activitySchema = z.discriminatedUnion("kind", [
  activityBase.extend({ kind: z.literal("thread") }),
  activityBase.extend({ kind: z.literal("reply"), id: replyId }),
]);
export const recentActivityOutput = z.strictObject({
  activities: z.array(activitySchema),
  nextCursor: activityCursor.nullable(),
  hasMore: z.boolean(),
});
export const threadOutput = z.strictObject({ thread: threadSchema });
export const threadDetailOutput = z.strictObject({
  thread: threadSchema,
  replies: z.array(replyEntrySchema),
});
export const replyOutput = z.strictObject({ reply: replySchema });
export const archiveOutput = z.strictObject({ archived: z.boolean() });
export const deletionOutput = z.strictObject({ deleted: z.boolean() });

export type ThreadSummary = z.infer<typeof threadSummarySchema>;
export type Reply = z.infer<typeof replySchema>;
export type ThreadDetail = z.infer<typeof threadDetailOutput>;
export type ThreadId = z.infer<typeof threadId>;
export type ReplyId = z.infer<typeof replyId>;
