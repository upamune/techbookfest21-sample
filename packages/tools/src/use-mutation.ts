import { useCallback, useRef, useState } from "react";

export function useMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const run = useCallback(async (operation: () => Promise<void>) => {
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
  }, []);
  const clearError = useCallback(() => setError(null), []);
  return { busy, error, run, clearError };
}
