import { useRef, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Trash2, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

function TaskWorkspace() {
  const model = useTasks();
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<Task | null>(null);
  const loaded = model.status.kind === "ready" || model.status.kind === "refreshing";
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
        <img className="brand" src="/pocket-horizontal.svg" alt="Pocket" width={88} height={32} />
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
                disabled={!loaded}
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
          <TaskListHeading tasks={model.tasks} loaded={loaded} />
          <TaskListContent
            model={model}
            select={(task, trigger) => {
              deleteTriggerRef.current = trigger;
              model.clearError();
              setTarget(task);
            }}
          />
        </section>
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

function TaskListHeading({ tasks, loaded }: { tasks: Task[]; loaded: boolean }) {
  return (
    <div className="task-list-heading" aria-live="polite" aria-atomic="true">
      <h2>
        表示中のタスク{" "}
        {loaded ? (
          <span className="task-count">{tasks.length}</span>
        ) : (
          <span className="task-count animate-pulse" aria-hidden="true">
            <span className="invisible">0</span>
          </span>
        )}
      </h2>
      {loaded ? (
        <span className="completion-count">
          完了 {tasks.filter((task) => task.completed).length}
        </span>
      ) : (
        <Skeleton className="completion-count" aria-hidden="true">
          <span className="invisible">完了 0</span>
        </Skeleton>
      )}
    </div>
  );
}

function TaskListContent({
  model,
  select,
}: {
  model: ReturnType<typeof useTasks>;
  select: (task: Task, trigger: HTMLButtonElement) => void;
}) {
  const { status } = model;
  const busy = model.busy || status.kind === "refreshing";
  return (
    <div className="task-list-content" aria-busy={busy}>
      {status.kind === "loading" && <TaskListSkeleton />}
      {status.kind === "failed" && (
        <div className="error-message">
          <p role="alert">{status.message}</p>
          <Button className="mt-3" variant="outline" onClick={() => void model.refresh()}>
            再試行
          </Button>
        </div>
      )}
      {(status.kind === "ready" || status.kind === "refreshing") && (
        <TaskList tasks={model.tasks} busy={busy} complete={model.complete} select={select} />
      )}
    </div>
  );
}

const skeletonTitleWidths = ["62%", "45%", "54%"];

function TaskListSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        読み込み中…
      </p>
      <ul className="task-list" aria-hidden="true">
        {skeletonTitleWidths.map((width) => (
          <li key={width} className="task-row">
            <Skeleton className="skeleton-checkbox" />
            <div className="task-title">
              <Skeleton className="skeleton-title" style={{ width }} />
            </div>
            <div className="skeleton-action">
              <Skeleton className="skeleton-icon" />
            </div>
          </li>
        ))}
      </ul>
    </>
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
