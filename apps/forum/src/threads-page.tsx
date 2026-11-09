import { useRef, useState, type FormEvent } from "react";
import { Link, useRouter } from "@void/react";
import { Archive, MessagesSquare, Plus } from "lucide-react";
import { callTool } from "@pocket/tools/request";
import { useMutation } from "@pocket/tools/use-mutation";
import { forgetLoadedResults } from "@pocket/tools/use-tool-query";
import { AskAiButton } from "@pocket/ask-ai/ask-ai-button";
import { AppBar } from "@pocket/ui/app-bar";
import { Button } from "@pocket/ui/button";
import { EmptyState, ErrorNotice } from "@pocket/ui/feedback";
import { Input } from "@pocket/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetTitle } from "@pocket/ui/sheet";
import { submitOnCommandEnter } from "@pocket/ui/submit-shortcut";
import { Textarea } from "@pocket/ui/textarea";
import { threadOutput } from "./contracts";
import { ThreadListMain } from "./thread-list";
import { webAuthorName } from "./web-author";

export function ThreadsPage() {
  const [composing, setComposing] = useState(false);
  return (
    <>
      <AppBar
        title="Forum"
        actions={
          <Link className="icon-link" href="/forum/archive" aria-label="アーカイブを見る">
            <Archive aria-hidden="true" />
          </Link>
        }
      />
      <ThreadListMain
        archived={false}
        empty={
          <EmptyState icon={MessagesSquare} title="まだスレッドはありません">
            右下のボタンから、最初の話題を投稿できます。
          </EmptyState>
        }
      />
      <AskAiButton floating suggestions={["最近の話題をまとめて", "返信がないスレッドは？"]} />
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
      forgetLoadedResults("forum_list_threads");
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
        <SheetTitle>スレッドを作成</SheetTitle>
        <form
          className="sheet-form"
          onSubmit={(event) => void submit(event)}
          onKeyDown={submitOnCommandEnter}
        >
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
              書き込む
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
