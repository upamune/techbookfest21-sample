import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { crossfade } from "./crossfade";
import { callTool } from "./request";

export type QueryState<T> =
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | { kind: "refreshing"; data: T }
  | { kind: "ready"; data: T }
  | { kind: "stale"; data: T; message: string };

const loadedResults = new Map<string, unknown>();

export function forgetLoadedResults(toolName?: string) {
  if (toolName === undefined) {
    loadedResults.clear();
    return;
  }
  for (const key of loadedResults.keys()) {
    if (key.startsWith(`${toolName}:`)) loadedResults.delete(key);
  }
}

const minimumSkeletonMs = 300;

function holdSkeleton() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, minimumSkeletonMs);
  });
}

function applyNow(apply: () => void) {
  apply();
}

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
  const serializedInput = JSON.stringify(input);
  const resultKey = `${name}:${serializedInput}`;
  const [state, setState] = useState<QueryState<T>>(() => {
    const loaded = schema.safeParse(loadedResults.get(resultKey));
    return loaded.success ? { kind: "refreshing", data: loaded.data } : { kind: "loading" };
  });
  const hasLoaded = useRef("data" in state);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setState((current) =>
        "data" in current ? { kind: "refreshing", data: current.data } : { kind: "loading" },
      );
      const skeletonHold = hasLoaded.current ? Promise.resolve() : holdSkeleton();
      const reveal = hasLoaded.current ? applyNow : crossfade;
      try {
        const body: unknown = JSON.parse(serializedInput);
        const data = await callTool({ name, input: body, schema, signal });
        loadedResults.set(resultKey, data);
        await skeletonHold;
        if (signal?.aborted) return;
        hasLoaded.current = true;
        reveal(() => setState({ kind: "ready", data }));
      } catch (cause) {
        await skeletonHold;
        if (signal?.aborted) return;
        const message = failureMessage(cause);
        reveal(() =>
          setState((current) =>
            "data" in current
              ? { kind: "stale", data: current.data, message }
              : { kind: "failed", message },
          ),
        );
      }
    },
    [name, resultKey, schema, serializedInput],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  const update = useCallback(
    (change: (data: T) => T) => {
      setState((current) => {
        if (!("data" in current)) return current;
        const data = change(current.data);
        loadedResults.set(resultKey, data);
        return { ...current, data };
      });
    },
    [resultKey],
  );
  return { state, refresh, update };
}
