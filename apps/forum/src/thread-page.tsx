import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useParams } from "@void/react";
import { Archive, ArrowUp, Trash2 } from "lucide-react";
import { callTool } from "@pocket/tools/request";
import { useMutation } from "@pocket/tools/use-mutation";
import { forgetLoadedResults, useToolQuery, type QueryState } from "@pocket/tools/use-tool-query";
import { AskAiButton } from "@pocket/ask-ai/ask-ai-button";
import { AppBar } from "@pocket/ui/app-bar";
import { Button } from "@pocket/ui/button";
import { ErrorNotice, Snackbar, type SnackbarMessage } from "@pocket/ui/feedback";
import { formatRelativeTime } from "@pocket/ui/format";
import { Skeleton } from "@pocket/ui/skeleton";
import { submitOnCommandEnter } from "@pocket/ui/submit-shortcut";
import { Textarea } from "@pocket/ui/textarea";
import {
  archiveOutput,
  deletionOutput,
  replyOutput,
  threadDetailOutput,
  threadId as threadIdSchema,
  type AuthorKind,
  type Reply,
  type ThreadDetail,
  type ThreadId,
} from "./contracts";
import { AuthorLabel } from "./author-label";
import { splitAnchors } from "./post-format";
import { webAuthorName } from "./web-author";

const forumPage = { label: "Forum", href: "/forum" } as const;
const openingPostNumber = 1;

export function ThreadPage() {
  const params = useParams<{ id: string }>();
  const id = threadIdSchema.safeParse(params.id);
  if (!id.success)
    return (
      <>
        <AppBar title="スレッド" parent={forumPage} />
        <main className="page">
          <ErrorNotice message="スレッドが見つかりません。" />
        </main>
      </>
    );
  return <ThreadView key={id.data} id={id.data} />;
}

function ThreadView({ id }: { id: ThreadId }) {
  const { state, refresh, update } = useToolQuery({
    name: "forum_get_thread",
    input: { id },
    schema: threadDetailOutput,
  });
  const [snackbar, setSnackbar] = useState<SnackbarMessage | null>(null);
  const dismissSnackbar = useCallback(() => setSnackbar(null), []);
  const removal = useMutation();
  const archiving = useMutation();
  const archived = "data" in state && state.data.thread.archivedAt !== null;
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");

  function quote(number: number) {
    setDraft((current) => `${current}>>${number}\n`);
    composerRef.current?.focus();
  }

  function setArchived(next: boolean) {
    void archiving.run(async () => {
      await callTool({
        name: "forum_set_thread_archived",
        input: { id, archived: next },
        schema: archiveOutput,
      });
      forgetLoadedResults("forum_list_threads");
      await refresh();
    });
  }

  function removeReply(reply: Reply) {
    void removal.run(async () => {
      await callTool({
        name: "forum_set_reply_deleted",
        input: { id: reply.id, deleted: true },
        schema: deletionOutput,
      });
      update((data) => ({
        ...data,
        replies: data.replies.map((item) =>
          item.id === reply.id ? { kind: "deleted", id: item.id, number: item.number } : item,
        ),
      }));
      setSnackbar({
        text: `${reply.number}番を削除しました`,
        undo: () => {
          setSnackbar(null);
          void removal.run(async () => {
            await callTool({
              name: "forum_set_reply_deleted",
              input: { id: reply.id, deleted: false },
              schema: deletionOutput,
            });
            await refresh();
          });
        },
      });
    });
  }

  return (
    <div className="thread-screen">
      <AppBar
        title="スレッド"
        parent={forumPage}
        actions={
          <>
            <AskAiButton
              page={{ tool: "forum_get_thread", input: { id } }}
              suggestions={["このスレッドを要約して", "次の返信案を考えて"]}
            />
            {!archived && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="スレッドをアーカイブ"
                disabled={!("data" in state) || archiving.busy}
                onClick={() => setArchived(true)}
              >
                <Archive aria-hidden="true" />
              </Button>
            )}
          </>
        }
      />
      <main className="page thread-main" aria-busy={state.kind === "loading"}>
        {removal.error && <ErrorNotice message={removal.error} />}
        {archiving.error && <ErrorNotice message={archiving.error} />}
        <ThreadContent
          state={state}
          busy={removal.busy}
          onRetry={() => void refresh()}
          onQuote={quote}
          onRemove={removeReply}
        />
        <div ref={endRef} />
      </main>
      {archived && <ArchivedNotice busy={archiving.busy} onRestore={() => setArchived(false)} />}
      {state.kind !== "failed" && !archived && (
        <ReplyComposer
          threadId={id}
          enabled={"data" in state}
          body={draft}
          bodyRef={composerRef}
          onBodyChange={setDraft}
          onReplied={(reply) => {
            update((data) => ({ ...data, replies: [...data.replies, reply] }));
            requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }));
          }}
        />
      )}
      <Snackbar message={snackbar} onDismiss={dismissSnackbar} />
    </div>
  );
}

function ThreadContent({
  state,
  busy,
  onRetry,
  onQuote,
  onRemove,
}: {
  state: QueryState<ThreadDetail>;
  busy: boolean;
  onRetry: () => void;
  onQuote: (number: number) => void;
  onRemove: (reply: Reply) => void;
}) {
  return (
    <>
      {state.kind === "stale" && <ErrorNotice message={state.message} />}
      {state.kind === "loading" && <ThreadSkeleton />}
      {state.kind === "failed" && <ErrorNotice message={state.message} onRetry={onRetry} />}
      {"data" in state && (
        <ThreadBody data={state.data} busy={busy} onQuote={onQuote} onRemove={onRemove} />
      )}
    </>
  );
}

function ArchivedNotice({ busy, onRestore }: { busy: boolean; onRestore: () => void }) {
  return (
    <div className="reply-composer">
      <div className="reply-composer-row thread-archived-row">
        <p>アーカイブ済みのスレッドです</p>
        <Button variant="outline" disabled={busy} onClick={onRestore}>
          元に戻す
        </Button>
      </div>
    </div>
  );
}

function ThreadBody({
  data,
  busy,
  onQuote,
  onRemove,
}: {
  data: ThreadDetail;
  busy: boolean;
  onQuote: (number: number) => void;
  onRemove: (reply: Reply) => void;
}) {
  const lastNumber = data.replies.at(-1)?.number ?? openingPostNumber;
  const open = data.thread.archivedAt === null;
  const quote = open ? onQuote : null;
  return (
    <>
      <article id={`res-${openingPostNumber}`} className="thread-head">
        <h2 className="thread-title">{data.thread.title}</h2>
        <PostHeader number={openingPostNumber} post={data.thread} onQuote={quote} />
        <PostBody body={data.thread.body} lastNumber={lastNumber} />
      </article>
      <ol className="reply-list">
        {data.replies.map((reply) => (
          <li key={reply.id} id={`res-${reply.number}`} className="reply">
            {reply.kind === "deleted" ? (
              <p className="reply-deleted">
                <span className="res-number">
                  <span className="res-chip">{reply.number}</span>
                </span>
                このレスは削除されました
              </p>
            ) : (
              <>
                <PostHeader
                  number={reply.number}
                  post={reply}
                  onQuote={quote}
                  action={
                    open && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${reply.number}番の返信を削除`}
                        disabled={busy}
                        onClick={() => onRemove(reply)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )
                  }
                />
                <PostBody body={reply.body} lastNumber={lastNumber} />
              </>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

function PostHeader({
  number,
  post,
  action,
  onQuote,
}: {
  number: number;
  post: { authorKind: AuthorKind; authorName: string; createdAt: string };
  action?: ReactNode;
  onQuote: ((number: number) => void) | null;
}) {
  const chip = <span className="res-chip">{number}</span>;
  return (
    <div className="post-header">
      {onQuote === null ? (
        <span className="res-number">{chip}</span>
      ) : (
        <button
          type="button"
          className="res-number"
          aria-label={`${number}番にレス`}
          onClick={() => onQuote(number)}
        >
          {chip}
        </button>
      )}
      <p className="post-byline">
        <AuthorLabel thread={post} />
        <time dateTime={post.createdAt}>{formatRelativeTime(post.createdAt)}</time>
      </p>
      {action}
    </div>
  );
}

function PostBody({ body, lastNumber }: { body: string; lastNumber: number }) {
  return (
    <p className="post-body">
      {splitAnchors(body).map((part) =>
        part.kind === "anchor" && part.number >= openingPostNumber && part.number <= lastNumber ? (
          <a key={part.start} className="res-anchor" href={`#res-${part.number}`}>
            {part.text}
          </a>
        ) : (
          <span key={part.start}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function ThreadSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        読み込み中…
      </p>
      <div className="thread-head" aria-hidden="true">
        <h2 className="thread-title">
          <Skeleton className="skeleton-line" style={{ width: "70%" }} />
        </h2>
        <div className="post-header">
          <span className="res-number">
            <Skeleton className="res-chip" />
          </span>
          <p className="post-byline">
            <Skeleton className="skeleton-line skeleton-meta" />
          </p>
        </div>
        <p className="post-body">
          <Skeleton className="skeleton-line" />
        </p>
      </div>
    </>
  );
}

function ReplyComposer({
  threadId,
  enabled,
  body,
  bodyRef,
  onBodyChange,
  onReplied,
}: {
  threadId: ThreadId;
  enabled: boolean;
  body: string;
  bodyRef: RefObject<HTMLTextAreaElement | null>;
  onBodyChange: (body: string) => void;
  onReplied: (reply: Reply) => void;
}) {
  const { busy, error, run } = useMutation();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const { reply } = await callTool({
        name: "forum_add_reply",
        input: { requestId, threadId, authorName: webAuthorName, body },
        schema: replyOutput,
      });
      onBodyChange("");
      setRequestId(crypto.randomUUID());
      onReplied(reply);
    });
  }
  return (
    <form
      className="reply-composer"
      onSubmit={(event) => void submit(event)}
      onKeyDown={submitOnCommandEnter}
    >
      {error && <ErrorNotice message={error} />}
      <div className="reply-composer-row">
        <Textarea
          ref={bodyRef}
          aria-label="返信"
          placeholder="レスを書く"
          value={body}
          maxLength={2000}
          rows={1}
          disabled={!enabled}
          readOnly={busy}
          onChange={(event) => onBodyChange(event.target.value)}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="書き込む"
          disabled={busy || !enabled || !body.trim()}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
