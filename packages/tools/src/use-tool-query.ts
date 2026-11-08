import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { callTool } from "./request";

export type QueryState<T> =
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | { kind: "refreshing"; data: T }
  | { kind: "ready"; data: T }
  | { kind: "stale"; data: T; message: string };

function failureMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "読み込めませんでした";
}

export function useToolQuery<T>({
  name,
  input,
  schema,
}: {
  name: string;
  input: object;
  schema: z.ZodType<T>;
}) {
  const [state, setState] = useState<QueryState<T>>({ kind: "loading" });
  const serializedInput = JSON.stringify(input);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setState((current) =>
        "data" in current ? { kind: "refreshing", data: current.data } : { kind: "loading" },
      );
      try {
        const body: unknown = JSON.parse(serializedInput);
        setState({ kind: "ready", data: await callTool({ name, input: body, schema, signal }) });
      } catch (cause) {
        if (signal?.aborted) return;
        const message = failureMessage(cause);
        setState((current) =>
          "data" in current
            ? { kind: "stale", data: current.data, message }
            : { kind: "failed", message },
        );
      }
    },
    [name, schema, serializedInput],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  const update = useCallback((change: (data: T) => T) => {
    setState((current) =>
      "data" in current ? { ...current, data: change(current.data) } : current,
    );
  }, []);
  return { state, refresh, update };
}
