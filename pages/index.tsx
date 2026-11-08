import { useRef, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Trash2, Terminal, ListTodo } from "lucide-react";
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
import { AuthGate } from "@/client/auth-gate";
import { useTasks } from "@/client/use-tasks";
import type { Task } from "@/tasks/contracts";
import "./style.css";

export default function HomePage() {
  return import.meta.env.DEV ? (
    <TaskWorkspace />
  ) : (
    <AuthGate>
      <TaskWorkspace />
    </AuthGate>
  );
}

const environmentLabel = import.meta.env.DEV ? "ローカル開発用" : "プライベートワークスペース";

function TaskWorkspace() {
  const model = useTasks();
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
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
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            p.
          </span>
          <span>Pocket</span>
        </div>
        <span className="environment-label">{environmentLabel}</span>
      </header>
      <main className="workspace">
        <section aria-label="タスク管理">
          <div className="workspace-heading">
            <div>
              <p className="workspace-kicker">WORKSPACE</p>
              <h1>タスク</h1>
              <p className="workspace-description">やることを追加して、終わったらチェック。</p>
            </div>
            <Button variant="outline" disabled={disabled} onClick={() => void model.refresh()}>
              <RefreshCw aria-hidden="true" />
              更新
            </Button>
          </div>
          <form onSubmit={(event) => void submit(event)} className="task-composer">
            <label htmlFor="new-task" className="composer-label">
              新しいタスク
            </label>
            <div className="composer-controls">
              <Input
                id="new-task"
                ref={inputRef}
                aria-describedby="task-title-hint"
                aria-label="新しいタスク"
                placeholder="次にやることを入力"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                disabled={model.status.kind !== "ready"}
                readOnly={model.busy}
              />
              <Button type="submit" disabled={disabled || !title.trim()}>
                <Plus aria-hidden="true" />
                追加
              </Button>
            </div>
            <p id="task-title-hint" className="composer-hint">
              200文字以内
            </p>
          </form>
          {model.error && target === null && (
            <p role="alert" className="error-message">
              {model.error}
            </p>
          )}
          <TaskListHeading tasks={model.tasks} ready={model.status.kind === "ready"} />
          <div className="task-list-content" aria-busy={model.busy}>
            {model.status.kind === "loading" && (
              <p role="status" className="list-message">
                読み込み中…
              </p>
            )}
            {model.status.kind === "failed" && (
              <div className="error-message">
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
                select={(task, trigger) => {
                  deleteTriggerRef.current = trigger;
                  model.clearError();
                  setTarget(task);
                }}
              />
            )}
          </div>
        </section>
        <aside className="developer-note">
          <details>
            <summary>
              <Terminal aria-hidden="true" />
              開発者向け情報
            </summary>
            <div className="developer-note-content">
              <h2>MCPでつなぐ</h2>
              <p>
                同じマシンのクライアントから /mcp に接続。標準のStreamable
                HTTPで4つの操作を利用できます。
              </p>
              <p>本番アクセスは認証と管理者による有効化が必要です。</p>
            </div>
          </details>
        </aside>
        <footer className="workspace-footer">
          <span>Void · React · Hono · D1 · Drizzle</span>
          <span>構成検証用サンプル</span>
        </footer>
      </main>
      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !model.busy) setTarget(null);
        }}
      >
        <DialogContent
          className="task-dialog"
          showCloseButton={false}
          initialFocus={cancelRef}
          finalFocus={() =>
            deleteTriggerRef.current?.isConnected ? deleteTriggerRef.current : inputRef.current
          }
        >
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
            <Button
              ref={cancelRef}
              variant="outline"
              disabled={model.busy}
              onClick={() => setTarget(null)}
            >
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
    </div>
  );
}

function TaskListHeading({ tasks, ready }: { tasks: Task[]; ready: boolean }) {
  return (
    <div className="task-list-heading" aria-live="polite" aria-atomic="true">
      <h2>
        表示中のタスク <span className="task-count">{ready ? tasks.length : "—"}</span>
      </h2>
      {ready && (
        <span className="completion-count">
          完了 {tasks.filter((task) => task.completed).length}
        </span>
      )}
    </div>
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
  select: (task: Task, trigger: HTMLButtonElement) => void;
}) {
  if (tasks.length === 0)
    return (
      <div className="empty-state">
        <ListTodo aria-hidden="true" />
        <p className="font-medium">まだタスクはありません</p>
        <p className="mt-2 text-sm text-muted-foreground">
          上の入力欄から、最初のタスクを追加できます。
        </p>
      </div>
    );
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.id} className="task-row">
          <Checkbox
            aria-label={`${task.title}を完了`}
            checked={task.completed}
            disabled={busy}
            onCheckedChange={(completed) => void complete({ id: task.id, completed })}
          />
          <span className={`task-title ${task.completed ? "is-completed" : ""}`}>{task.title}</span>
          <Button
            aria-label={`${task.title}を削除`}
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={(event) => select(task, event.currentTarget)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
