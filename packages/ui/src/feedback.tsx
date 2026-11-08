import { useEffect, type ComponentType, type ReactNode } from "react";
import { Button } from "./primitives/button";

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ "aria-hidden": "true" }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon aria-hidden="true" />
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-body">{children}</p>
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-message">
      <p role="alert">{message}</p>
      {onRetry && (
        <Button className="error-retry" variant="outline" onClick={onRetry}>
          再試行
        </Button>
      )}
    </div>
  );
}

export type SnackbarMessage = { text: string; undo: () => void };

const snackbarDuration = 6000;

export function Snackbar({
  message,
  onDismiss,
}: {
  message: SnackbarMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(onDismiss, snackbarDuration);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);
  return (
    <div className="snackbar-region" role="status" aria-live="polite">
      {message && (
        <div className="snackbar">
          <span className="snackbar-text">{message.text}</span>
          <button type="button" className="snackbar-action" onClick={message.undo}>
            元に戻す
          </button>
        </div>
      )}
    </div>
  );
}
