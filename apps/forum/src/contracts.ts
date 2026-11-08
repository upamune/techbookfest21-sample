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

export const threadSchema = post.extend({ id: threadId, title });
export const threadSummarySchema = threadSchema.extend({
  replyCount: z.number().int().nonnegative(),
  lastActivityAt: z.iso.datetime(),
});
export const replySchema = post.extend({ id: replyId, threadId });

export const createThreadInput = { requestId, authorName, title, body };
export const addReplyInput = { requestId, threadId, authorName, body };
export const getThreadInput = { id: threadId };
export const setThreadDeletedInput = { id: threadId, deleted: z.boolean() };
export const setReplyDeletedInput = { id: replyId, deleted: z.boolean() };

export const threadListOutput = z.strictObject({ threads: z.array(threadSummarySchema) });
export const threadOutput = z.strictObject({ thread: threadSchema });
export const threadDetailOutput = z.strictObject({
  thread: threadSchema,
  replies: z.array(replySchema),
});
export const replyOutput = z.strictObject({ reply: replySchema });
export const deletionOutput = z.strictObject({ deleted: z.boolean() });

export type ThreadSummary = z.infer<typeof threadSummarySchema>;
export type Reply = z.infer<typeof replySchema>;
export type ThreadId = z.infer<typeof threadId>;
export type ReplyId = z.infer<typeof replyId>;
