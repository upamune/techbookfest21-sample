import { useState, type FormEvent } from "react";
import { Plus, RefreshCw, Trash2, Terminal, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTasks } from "@/client/use-tasks";
import type { Task } from "@/tasks/contracts";
import "./style.css";

export default function HomePage() {
  const model = useTasks();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<Task | null>(null);
  const disabled = model.busy || model.status.kind !== "ready";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await model.create(title)) setTitle("");
  }
  async function confirmDelete() {
    if (target && (await model.remove(target.id))) setTarget(null);
  }
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      <header className="mb-10 flex items-center justify-between border-b pb-5">
        <span className="font-semibold tracking-tight">VOID / TASK LAB</span>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">LOCAL ONLY</span>
      </header>
      <p className="mb-3 text-sm font-medium text-primary">人とエージェント、同じデータから。</p>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight sm:text-5xl">
        次の一歩を、ひとつずつ。
      </h1>
      <p className="max-w-lg leading-7 text-muted-foreground">
        画面でも、MCPでも。同じタスクを作成・確認できる、小さな開発用サンプルです。
      </p>
      <section
        aria-label="タスク管理"
        className="my-10 rounded-2xl border bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            タスク <span className="ml-2 text-sm text-muted-foreground">{model.tasks.length}</span>
          </h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => void model.refresh()}
          >
            <RefreshCw />
            更新
          </Button>
        </div>
        <form onSubmit={(event) => void submit(event)} className="mb-6 flex gap-2">
          <Input
            aria-label="新しいタスク"
            placeholder="次にやることを入力"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            disabled={disabled}
          />
          <Button type="submit" disabled={disabled || !title.trim()}>
            <Plus />
            追加
          </Button>
        </form>
        {model.error && target === null && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-destructive">
            {model.error}
          </p>
        )}
        <div aria-live="polite">
          {model.status.kind === "loading" && (
            <p className="py-10 text-center text-muted-foreground">読み込み中…</p>
          )}
          {model.status.kind === "failed" && (
            <div className="rounded-lg bg-red-50 p-4">
              <p role="alert">{model.status.message}</p>
              <Button className="mt-3" variant="outline" onClick={() => void model.refresh()}>
                再試行
              </Button>
            </div>
          )}
          {model.status.kind === "ready" && (
            <TaskList
              tasks={model.tasks}
              busy={model.busy}
              complete={model.complete}
              select={(task) => {
                model.clearError();
                setTarget(task);
              }}
            />
          )}
        </div>
      </section>
      <aside className="flex gap-4 rounded-xl bg-secondary p-5">
        <Terminal className="mt-1 size-5 shrink-0 text-primary" />
        <div>
          <h2 className="font-semibold">MCPでつなぐ</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            同じマシンのクライアントから /api/mcp に接続。標準のStreamable
            HTTPで4つの操作を利用できます。
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            認証は未実装です。本番ビルドではAPI・MCPを無効化しています。
          </p>
        </div>
      </aside>
      <footer className="mt-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Void · React · Hono · D1 · Drizzle</span>
        <ArrowUpRight className="size-3" />
        <span>書籍の最終題材ではなく、構成検証用</span>
      </footer>
      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !model.busy) setTarget(null);
        }}
      >
        <DialogContent showCloseButton={!model.busy}>
          <DialogHeader>
            <DialogTitle>タスクを削除しますか？</DialogTitle>
            <DialogDescription>
              「{target?.title}」を削除します。この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>
          {model.error && (
            <p role="alert" className="text-sm text-destructive">
              {model.error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={model.busy} onClick={() => setTarget(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={model.busy}
              onClick={() => void confirmDelete()}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function TaskList({
  tasks,
  busy,
  complete,
  select,
}: {
  tasks: Task[];
  busy: boolean;
  complete: (input: Pick<Task, "id" | "completed">) => Promise<boolean>;
  select: (task: Task) => void;
}) {
  if (tasks.length === 0)
    return (
      <div className="rounded-xl border border-dashed px-4 py-12 text-center">
        <p className="font-medium">まだタスクはありません</p>
        <p className="mt-2 text-sm text-muted-foreground">小さな一歩を追加してみましょう。</p>
      </div>
    );
  return (
    <ul className="divide-y">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-3 py-4">
          <Checkbox
            aria-label={`${task.title}を完了`}
            checked={task.completed}
            disabled={busy}
            onCheckedChange={(completed) => void complete({ id: task.id, completed })}
          />
          <span
            className={`min-w-0 flex-1 break-words ${task.completed ? "text-muted-foreground line-through" : ""}`}
          >
            {task.title}
          </span>
          <Button
            aria-label={`${task.title}を削除`}
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={() => select(task)}
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
