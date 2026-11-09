import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type RefObject,
} from "react";
import { fetchServerSentEvents, useChat, type UIMessage } from "@tanstack/ai-react";
import { TextPart } from "@tanstack/ai-react/ui";
import { ArrowUp, Check, Square, SquarePen } from "lucide-react";
import { Button } from "@pocket/ui/button";
import { ErrorNotice } from "@pocket/ui/feedback";
import { Sheet, SheetContent, SheetTitle } from "@pocket/ui/sheet";
import { Skeleton } from "@pocket/ui/skeleton";
import { submitOnCommandEnter } from "@pocket/ui/submit-shortcut";
import { Textarea } from "@pocket/ui/textarea";
import { z } from "zod";
import type { AskAiSheetProps } from "./ask-ai-button";
import type { AskAiClientTools, AskAiToolDisplay } from "./tool-definitions";

const errorBody = z.object({ error: z.string() });
const toolArguments = z.record(z.string(), z.unknown());
const pinnedDistance = 48;

async function fetchWithErrorMessage(...args: Parameters<typeof fetch>) {
  const response = await fetch(...args);
  if (response.ok) return response;
  const body: unknown = await response.json().catch(() => null);
  const parsed = errorBody.safeParse(body);
  const message = parsed.success ? parsed.data.error : "Ask AI に接続できませんでした。";
  const event = { type: "RUN_ERROR", message, timestamp: Date.now() };
  return new Response(`data: ${JSON.stringify(event)}\n\n`, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

const connection = fetchServerSentEvents("/api/ai/chat", {
  fetchClient: fetchWithErrorMessage,
});

const markdownComponents: ComponentProps<typeof TextPart>["components"] = {
  img: () => null,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="ask-ai-table">
      <table>{children}</table>
    </div>
  ),
};

export default function AskAiSheet({
  page,
  suggestions,
  tools,
  open,
  onOpenChange,
}: AskAiSheetProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const pinnedToEnd = useRef(true);
  const [threadId] = useState(() => crypto.randomUUID());
  const { messages, sendMessage, isLoading, stop, interrupts, error, clear, reload, resuming } =
    useChat({
      connection,
      threadId,
      tools: tools.approvalTools,
      forwardedProps: page === undefined ? {} : { page },
    });
  const approvals = interrupts.flatMap((interrupt) =>
    interrupt.kind === "tool-approval" ? [interrupt] : [],
  );
  const approvalIds = new Set(approvals.map((approval) => approval.toolCallId));
  const waiting = isLoading && !isStreamingText(messages.at(-1)) && approvals.length === 0;

  useEffect(() => {
    const log = logRef.current;
    if (log !== null && pinnedToEnd.current) log.scrollTop = log.scrollHeight;
  }, [messages, approvals.length, waiting, error]);

  function ask(question: string) {
    pinnedToEnd.current = true;
    void sendMessage(question);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="ask-ai-sheet" initialFocus={inputRef}>
        <header className="ask-ai-header">
          <SheetTitle>AIに聞く</SheetTitle>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="新しい会話"
              disabled={isLoading}
              onClick={clear}
            >
              <SquarePen aria-hidden="true" />
            </Button>
          )}
        </header>
        <div
          ref={logRef}
          className="ask-ai-log"
          aria-live="polite"
          onScroll={({ currentTarget: log }) => {
            pinnedToEnd.current =
              log.scrollHeight - log.scrollTop - log.clientHeight < pinnedDistance;
          }}
        >
          {messages.length === 0 && <EmptyConversation suggestions={suggestions} onAsk={ask} />}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              hiddenToolCalls={approvalIds}
              display={tools.display}
              isLoading={isLoading}
            />
          ))}
          {waiting && (
            <div className="ask-ai-message" data-role="assistant">
              <p role="status" className="sr-only">
                読み込み中…
              </p>
              <Skeleton className="skeleton-line ask-ai-skeleton" />
              <Skeleton className="skeleton-line ask-ai-skeleton-short" />
            </div>
          )}
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.toolCallId}
              toolName={approval.toolName}
              args={approval.originalArgs}
              display={tools.display[approval.toolName]}
              busy={resuming}
              onResolve={(approved) => approval.resolveInterrupt(approved)}
            />
          ))}
          {error && <ErrorNotice message={error.message} onRetry={() => void reload()} />}
        </div>
        <ChatComposer inputRef={inputRef} isLoading={isLoading} onAsk={ask} onStop={stop} />
      </SheetContent>
    </Sheet>
  );
}

function isStreamingText(message: UIMessage | undefined) {
  return message?.role === "assistant" && message.parts.at(-1)?.type === "text";
}

function ChatComposer({
  inputRef,
  isLoading,
  onAsk,
  onStop,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isLoading: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}) {
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (question === "" || isLoading) return;
    setDraft("");
    onAsk(question);
  }

  return (
    <form className="ask-ai-composer" onSubmit={submit} onKeyDown={submitOnCommandEnter}>
      <Textarea
        ref={inputRef}
        aria-label="AIへの質問"
        placeholder="質問を入力"
        value={draft}
        maxLength={2000}
        rows={1}
        onChange={(event) => setDraft(event.target.value)}
      />
      {isLoading ? (
        <Button size="icon" aria-label="応答を止める" onClick={onStop}>
          <Square aria-hidden="true" />
        </Button>
      ) : (
        <Button type="submit" size="icon" aria-label="送信" disabled={!draft.trim()}>
          <ArrowUp aria-hidden="true" />
        </Button>
      )}
    </form>
  );
}

function ChatMessage({
  message,
  hiddenToolCalls,
  display,
  isLoading,
}: {
  message: UIMessage;
  hiddenToolCalls: Set<string>;
  display: AskAiClientTools["display"];
  isLoading: boolean;
}) {
  const finished = new Set(
    message.parts.flatMap((part) => (part.type === "tool-result" ? [part.toolCallId] : [])),
  );
  return (
    <div className="ask-ai-message" data-role={message.role}>
      {message.parts.map((part, index) => {
        if (part.type === "text")
          return message.role === "user" ? (
            <p key={index} className="ask-ai-question">
              {part.content}
            </p>
          ) : (
            <TextPart
              key={index}
              content={part.content}
              role="assistant"
              className="ask-ai-markdown"
              components={markdownComponents}
            />
          );
        if (part.type === "tool-call" && !hiddenToolCalls.has(part.id))
          return (
            <ToolStatus
              key={part.id}
              label={display[part.name]?.label ?? part.name}
              running={isLoading && !finished.has(part.id)}
            />
          );
        return null;
      })}
    </div>
  );
}

function ApprovalCard({
  toolName,
  args,
  display,
  busy,
  onResolve,
}: {
  toolName: string;
  args: unknown;
  display?: AskAiToolDisplay;
  busy: boolean;
  onResolve: (approved: boolean) => void;
}) {
  return (
    <section className="ask-ai-approval">
      <h3>この操作を実行しますか？</h3>
      <p className="ask-ai-approval-label">{display?.label ?? toolName}</p>
      <ToolArguments value={args} display={display} />
      <div className="ask-ai-approval-actions">
        <Button variant="outline" disabled={busy} onClick={() => onResolve(false)}>
          やめる
        </Button>
        <Button disabled={busy} onClick={() => onResolve(true)}>
          実行する
        </Button>
      </div>
    </section>
  );
}

function EmptyConversation({
  suggestions,
  onAsk,
}: {
  suggestions: string[];
  onAsk: (question: string) => void;
}) {
  return (
    <div className="ask-ai-empty">
      <p>この画面の内容について質問できます。投稿や変更は、実行する前に確認します。</p>
      <div className="ask-ai-suggestions">
        {suggestions.map((suggestion) => (
          <Button key={suggestion} variant="outline" onClick={() => onAsk(suggestion)}>
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ToolStatus({ label, running }: { label: string; running: boolean }) {
  return (
    <p className="ask-ai-tool" data-running={running || undefined}>
      {running ? <span className="ask-ai-tool-dot" /> : <Check aria-hidden="true" />}
      {label}
    </p>
  );
}

function formatArgument(argument: unknown) {
  if (typeof argument === "boolean") return argument ? "はい" : "いいえ";
  return typeof argument === "string" ? argument : JSON.stringify(argument);
}

function ToolArguments({ value, display }: { value: unknown; display?: AskAiToolDisplay }) {
  const parsed = toolArguments.safeParse(value);
  if (!parsed.success || display?.fields === undefined) return null;
  const shown = Object.entries(display.fields).filter(
    ([name]) => parsed.data[name] !== undefined && parsed.data[name] !== "",
  );
  return (
    <dl className="ask-ai-arguments">
      {shown.map(([name, label]) => (
        <div key={name}>
          <dt>{label}</dt>
          <dd>{formatArgument(parsed.data[name])}</dd>
        </div>
      ))}
    </dl>
  );
}
