import type { ReactNode } from "react";

export function AppBar({
  title,
  leading,
  actions,
}: {
  title: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        {leading}
        <h1 className="app-bar-title">{title}</h1>
        <div className="app-bar-actions">{actions}</div>
      </div>
    </header>
  );
}
