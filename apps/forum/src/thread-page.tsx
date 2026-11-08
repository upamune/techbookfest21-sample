import { useCallback, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "@void/react";
import { MessagesSquare, SendHorizontal, Trash2 } from "lucide-react";
import { callTool } from "@pocket/tools/request";
import { useMutation } from "@pocket/tools/use-mutation";
import { forgetLoadedResults, useToolQuery } from "@pocket/tools/use-tool-query";
import { AppBar } from "@pocket/ui/app-bar";
import { Button } from "@pocket/ui/button";
import { EmptyState, ErrorNotice, Snackbar, type SnackbarMessage } from "@pocket/ui/feedback";
import { formatRelativeTime } from "@pocket/ui/format";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from "@pocket/ui/sheet";
import { Skeleton } from "@pocket/ui/skeleton";
import { Textarea } from "@pocket/ui/textarea";
import {
  deletionOutput,
  replyOutput,
  threadDetailOutput,
  threadId as threadIdSchema,
  type Reply,
  type ThreadId,
} from "./contracts";
import { AuthorLabel } from "./author-label";
import { webAuthorName } from "./web-author";

const forumPage = { label: "Forum", href: "/forum" } as const;

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarMessage | null>(null);
  const dismissSnackbar = useCallback(() => setSnackbar(null), []);
  const removal = useMutation();
  const endRef = useRef<HTMLDivElement>(null);

  function removeReply(reply: Reply) {
    void removal.run(async () => {
      await callTool({
        name: "forum_set_reply_deleted",
        input: { id: reply.id, deleted: true },
        schema: deletionOutput,
      });
      update((data) => ({
        ...data,
        replies: data.replies.filter((item) => item.id !== reply.id),
      }));
      setSnackbar({
        text: "返信を削除しました",
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="スレッドを削除"
            disabled={!("data" in state)}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        }
      />
      <main className="page thread-main" aria-busy={state.kind === "loading"}>
        {removal.error && <ErrorNotice message={removal.error} />}
        {state.kind === "stale" && <ErrorNotice message={state.message} />}
        {state.kind === "loading" && <ThreadSkeleton />}
        {state.kind === "failed" && (
          <ErrorNotice message={state.message} onRetry={() => void refresh()} />
        )}
        {"data" in state && (
          <>
            <article className="thread-head">
              <h2 className="thread-title">{state.data.thread.title}</h2>
              <p className="post-meta">
                <AuthorLabel thread={state.data.thread} />
                <span>{formatRelativeTime(state.data.thread.createdAt)}</span>
              </p>
              <p className="post-body">{state.data.thread.body}</p>
            </article>
            <h3 className="reply-heading">返信 {state.data.replies.length}</h3>
            <ReplyList replies={state.data.replies} busy={removal.busy} onRemove={removeReply} />
          </>
        )}
        <div ref={endRef} />
      </main>
      {state.kind !== "failed" && (
        <ReplyComposer
          threadId={id}
          enabled={"data" in state}
          onReplied={(reply) => {
            update((data) => ({ ...data, replies: [...data.replies, reply] }));
            requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }));
          }}
        />
      )}
      <Snackbar message={snackbar} onDismiss={dismissSnackbar} />
      <DeleteThreadSheet
        id={id}
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

function ReplyList({
  replies,
  busy,
  onRemove,
}: {
  replies: Reply[];
  busy: boolean;
  onRemove: (reply: Reply) => void;
}) {
  if (replies.length === 0)
    return (
      <EmptyState icon={MessagesSquare} title="まだ返信はありません">
        下の入力欄から返信できます。
      </EmptyState>
    );
  return (
    <ul className="reply-list">
      {replies.map((reply) => (
        <li key={reply.id} className="reply">
          <div className="reply-header">
            <p className="post-meta">
              <AuthorLabel thread={reply} />
              <span>{formatRelativeTime(reply.createdAt)}</span>
            </p>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${reply.authorName}の返信を削除`}
              disabled={busy}
              onClick={() => onRemove(reply)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
          <p className="post-body">{reply.body}</p>
        </li>
      ))}
    </ul>
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
        <p className="post-meta">
          <Skeleton className="skeleton-line skeleton-meta" />
        </p>
        <p className="post-body">
          <Skeleton className="skeleton-line" />
        </p>
      </div>
      <h3 className="reply-heading" aria-hidden="true">
        <Skeleton className="skeleton-line skeleton-meta" />
      </h3>
    </>
  );
}

function ReplyComposer({
  threadId,
  enabled,
  onReplied,
}: {
  threadId: ThreadId;
  enabled: boolean;
  onReplied: (reply: Reply) => void;
}) {
  const { busy, error, run } = useMutation();
  const [body, setBody] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const { reply } = await callTool({
        name: "forum_add_reply",
        input: { requestId, threadId, authorName: webAuthorName, body },
        schema: replyOutput,
      });
      setBody("");
      setRequestId(crypto.randomUUID());
      onReplied(reply);
    });
  }
  return (
    <form className="reply-composer" onSubmit={(event) => void submit(event)}>
      {error && <ErrorNotice message={error} />}
      <div className="reply-composer-row">
        <Textarea
          aria-label="返信"
          placeholder="返信を入力"
          value={body}
          maxLength={2000}
          rows={1}
          disabled={!enabled}
          readOnly={busy}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="送信"
          disabled={busy || !enabled || !body.trim()}
        >
          <SendHorizontal aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}

function DeleteThreadSheet({
  id,
  open,
  onClose,
}: {
  id: ThreadId;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { busy, error, run } = useMutation();
  async function confirm() {
    await run(async () => {
      await callTool({
        name: "forum_set_thread_deleted",
        input: { id, deleted: true },
        schema: deletionOutput,
      });
      forgetLoadedResults("forum_list_threads");
      onClose();
      await router.visit("/forum");
    });
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <SheetContent initialFocus={cancelRef}>
        <SheetTitle>スレッドを削除しますか？</SheetTitle>
        <SheetDescription>一覧から消えます。データはMCPから元に戻せます。</SheetDescription>
        {error && <ErrorNotice message={error} />}
        <SheetFooter>
          <Button ref={cancelRef} variant="outline" disabled={busy} onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
            削除する
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
