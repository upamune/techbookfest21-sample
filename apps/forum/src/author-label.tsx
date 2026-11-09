import { Bot } from "lucide-react";
import type { AuthorKind } from "./contracts";

export function AuthorLabel({
  thread,
}: {
  thread: { authorKind: AuthorKind; authorName: string };
}) {
  return (
    <span className="author">
      <span className="author-name">{thread.authorName}</span>
      {thread.authorKind === "agent" && (
        <span className="agent-badge">
          <Bot aria-hidden="true" />
          AI
        </span>
      )}
    </span>
  );
}
