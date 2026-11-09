import type { ReactNode } from "react";
import { Link } from "@void/react";
import { MessageSquare } from "lucide-react";
import { useToolQuery } from "@pocket/tools/use-tool-query";
import { ErrorNotice } from "@pocket/ui/feedback";
import { formatRelativeTime } from "@pocket/ui/format";
import { Skeleton } from "@pocket/ui/skeleton";
import { AuthorLabel } from "./author-label";
import { threadListOutput, type ThreadSummary } from "./contracts";

export function ThreadListMain({ archived, empty }: { archived: boolean; empty: ReactNode }) {
  const { state, refresh } = useToolQuery({
    name: "forum_list_threads",
    input: { archived },
    schema: threadListOutput,
  });
  return (
    <main className="page" aria-busy={state.kind === "loading" || state.kind === "refreshing"}>
      {state.kind === "stale" && <ErrorNotice message={state.message} />}
      {state.kind === "loading" && <ThreadListSkeleton />}
      {state.kind === "failed" && (
        <ErrorNotice message={state.message} onRetry={() => void refresh()} />
      )}
      {"data" in state &&
        (state.data.threads.length === 0 ? empty : <ThreadRows {...state.data} />)}
    </main>
  );
}

function ThreadRows({ threads }: { threads: ThreadSummary[] }) {
  return (
    <ol className="thread-list">
      {threads.map((thread) => (
        <li key={thread.id}>
          <Link className="thread-row" href={`/forum/${thread.id}`}>
            <span className="thread-row-title">{thread.title}</span>
            <span className="thread-row-meta">
              <AuthorLabel thread={thread} />
              <span>{formatRelativeTime(thread.lastActivityAt)}</span>
            </span>
            <span className="thread-row-count">
              <MessageSquare aria-hidden="true" />
              <span className="sr-only">返信</span>
              {thread.replyCount}
              <span className="sr-only">件</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

const skeletonWidths = ["72%", "54%", "63%", "48%"];

function ThreadListSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        読み込み中…
      </p>
      <ol className="thread-list" aria-hidden="true">
        {skeletonWidths.map((width) => (
          <li key={width}>
            <div className="thread-row">
              <span className="thread-row-title">
                <Skeleton className="skeleton-line" style={{ width }} />
              </span>
              <span className="thread-row-meta">
                <Skeleton className="skeleton-line skeleton-meta" />
              </span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
