import { useCallback, useEffect, useRef, useState } from "react";
import { tasksResponse, taskResponse, deletionResponse, type Task } from "@/tasks/contracts";
import { jsonRequest, request } from "./request";

type Status = { kind: "loading" } | { kind: "ready" } | { kind: "failed"; message: string };

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setStatus({ kind: "loading" });
    try {
      const result = await request({ path: "/api/tasks", schema: tasksResponse, init: { signal } });
      setTasks(result.tasks);
      setStatus({ kind: "ready" });
    } catch (cause) {
      if (signal?.aborted) return;
      setStatus({
        kind: "failed",
        message: cause instanceof Error ? cause.message : "読み込めませんでした",
      });
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  async function mutate(operation: () => Promise<void>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await operation();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作を完了できませんでした");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function create(title: string) {
    return mutate(async () => {
      const { task } = await request({
        path: "/api/tasks",
        schema: taskResponse,
        init: jsonRequest({ method: "POST", body: { title } }),
      });
      setTasks((items) => [task, ...items].slice(0, 100));
    });
  }
  function complete({ id, completed }: Pick<Task, "id" | "completed">) {
    return mutate(async () => {
      const { task } = await request({
        path: `/api/tasks/${id}`,
        schema: taskResponse,
        init: jsonRequest({ method: "PATCH", body: { completed } }),
      });
      setTasks((items) => items.map((item) => (item.id === task.id ? task : item)));
    });
  }
  function remove(id: Task["id"]) {
    return mutate(async () => {
      await request({
        path: `/api/tasks/${id}`,
        schema: deletionResponse,
        init: { method: "DELETE" },
      });
      setTasks((items) => items.filter((item) => item.id !== id));
    });
  }
  return {
    tasks,
    status,
    busy,
    error,
    refresh,
    create,
    complete,
    remove,
    clearError: () => setError(null),
  };
}
