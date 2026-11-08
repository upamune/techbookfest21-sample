import { useRef, useState, type FormEvent } from "react";
import { Link, useRouter } from "@void/react";
import { MessagesSquare, Plus, RefreshCw } from "lucide-react";
import { callTool } from "@pocket/tools/request";
import { useMutation } from "@pocket/tools/use-mutation";
import { useToolQuery } from "@pocket/tools/use-tool-query";
import { AppBar } from "@pocket/ui/app-bar";
import { Button } from "@pocket/ui/button";
import { EmptyState, ErrorNotice } from "@pocket/ui/feedback";
import { formatRelativeTime } from "@pocket/ui/format";
import { Input } from "@pocket/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetTitle } from "@pocket/ui/sheet";
import { Skeleton } from "@pocket/ui/skeleton";
import { Textarea } from "@pocket/ui/textarea";
import { AuthorLabel } from "./author-label";
import { threadListOutput, threadOutput, type ThreadSummary } from "./contracts";
import { webAuthorName } from "./web-author";

const noInput = {};

export function ThreadsPage() {
  const { state, refresh } = useToolQuery({
    name: "forum_list_threads",
    input: noInput,
    schema: threadListOutput,
  });
  const [composing, setComposing] = useState(false);
  return (
    <>
      <AppBar
        title="Forum"
        actions={
          <Button
            variant="ghost"
            size="icon"
            aria-label="更新"
            disabled={state.kind === "loading" || state.kind === "refreshing"}
            onClick={() => void refresh()}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        }
      />
      <main className="page" aria-busy={state.kind === "loading" || state.kind === "refreshing"}>
        {state.kind === "stale" && <ErrorNotice message={state.message} />}
        {state.kind === "loading" && <ThreadListSkeleton />}
        {state.kind === "failed" && (
          <ErrorNotice message={state.message} onRetry={() => void refresh()} />
        )}
        {"data" in state && <ThreadList threads={state.data.threads} />}
      </main>
      <button
        type="button"
        className="fab"
        aria-label="スレッドを作成"
        onClick={() => setComposing(true)}
      >
        <Plus aria-hidden="true" />
      </button>
      <NewThreadSheet open={composing} onClose={() => setComposing(false)} />
    </>
  );
}

function ThreadList({ threads }: { threads: ThreadSummary[] }) {
  if (threads.length === 0)
    return (
      <EmptyState icon={MessagesSquare} title="まだスレッドはありません">
        右下のボタンから、最初の話題を投稿できます。
      </EmptyState>
    );
  return (
    <ul className="thread-list">
      {threads.map((thread) => (
        <li key={thread.id}>
          <Link className="thread-row" href={`/forum/${thread.id}`}>
            <span className="thread-row-title">{thread.title}</span>
            <span className="thread-row-body">{thread.body}</span>
            <span className="thread-row-meta">
              <AuthorLabel thread={thread} />
              <span>{formatRelativeTime(thread.lastActivityAt)}</span>
              <span className="thread-row-replies">返信 {thread.replyCount}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const skeletonWidths = ["72%", "54%", "63%", "48%"];

function ThreadListSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        読み込み中…
      </p>
      <ul className="thread-list" aria-hidden="true">
        {skeletonWidths.map((width) => (
          <li key={width}>
            <div className="thread-row">
              <span className="thread-row-title">
                <Skeleton className="skeleton-line" style={{ width }} />
              </span>
              <span className="thread-row-body">
                <Skeleton className="skeleton-line" />
              </span>
              <span className="thread-row-meta">
                <Skeleton className="skeleton-line skeleton-meta" />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function NewThreadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { busy, error, run } = useMutation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const { thread } = await callTool({
        name: "forum_create_thread",
        input: { requestId, authorName: webAuthorName, title, body },
        schema: threadOutput,
      });
      setTitle("");
      setBody("");
      setRequestId(crypto.randomUUID());
      onClose();
      await router.visit(`/forum/${thread.id}`);
    });
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <SheetContent initialFocus={titleRef}>
        <SheetTitle>新しいスレッド</SheetTitle>
        <form className="sheet-form" onSubmit={(event) => void submit(event)}>
          <label className="field">
            <span className="field-label">タイトル</span>
            <Input
              ref={titleRef}
              value={title}
              maxLength={120}
              enterKeyHint="next"
              required
              readOnly={busy}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">本文</span>
            <Textarea
              value={body}
              maxLength={2000}
              rows={5}
              required
              readOnly={busy}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          {error && <ErrorNotice message={error} />}
          <SheetFooter>
            <Button variant="outline" disabled={busy} onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={busy || !title.trim() || !body.trim()}>
              投稿
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
