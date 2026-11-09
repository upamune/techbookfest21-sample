import { useEffect, useRef, useState } from "react";
import { request } from "@pocket/tools/request";
import { Button } from "@pocket/ui/button";
import { ErrorNotice } from "@pocket/ui/feedback";
import { Skeleton } from "@pocket/ui/skeleton";
import { z } from "zod";
import { clientPublisher } from "./oauth-client";

const connection = z.object({
  clientId: z.string(),
  name: z.string().nullable(),
  connectedAt: z.number(),
});
const connectionList = z.object({ connections: z.array(connection) });
type Connection = z.infer<typeof connection>;

type View = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; connections: Connection[] };

function loadConnections() {
  return request({ path: "/api/oauth-connections", schema: connectionList });
}

export function OAuthConnectionsPanel() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [revokeFailed, setRevokeFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function refresh() {
    setView({ kind: "loading" });
    try {
      const { connections } = await loadConnections();
      setView({ kind: "ready", connections });
    } catch {
      setView({ kind: "failed" });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function revoke(clientId: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setRevokeFailed(false);
    try {
      await request({
        path: `/api/oauth-connections?${new URLSearchParams({ clientId })}`,
        schema: z.object({ revoked: z.boolean() }),
        init: { method: "DELETE" },
      });
      const { connections } = await loadConnections();
      setView({ kind: "ready", connections });
    } catch {
      setRevokeFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="settings-section" aria-label="接続中のアプリ">
      <h2>接続中のアプリ</h2>
      <p className="settings-note">
        OAuthで接続したアプリです。解除すると、そのアプリはすぐにアクセスできなくなります。
      </p>
      {revokeFailed && <ErrorNotice message="解除できませんでした。再試行してください。" />}
      <ConnectionRows view={view} busy={busy} onRevoke={revoke} onRetry={refresh} />
    </section>
  );
}

function ConnectionRows({
  view,
  busy,
  onRevoke,
  onRetry,
}: {
  view: View;
  busy: boolean;
  onRevoke: (clientId: string) => Promise<void>;
  onRetry: () => Promise<void>;
}) {
  switch (view.kind) {
    case "loading":
      return (
        <div className="settings-group">
          <div className="settings-row">
            <p role="status" className="sr-only">
              接続中のアプリを読み込み中…
            </p>
            <span className="settings-row-text">
              <Skeleton className="oauth-consent-skeleton" style={{ width: "50%" }} />
              <Skeleton className="oauth-consent-skeleton" style={{ width: "35%" }} />
            </span>
            <Button variant="ghost" disabled>
              解除
            </Button>
          </div>
        </div>
      );
    case "failed":
      return (
        <ErrorNotice
          message="接続中のアプリを読み込めませんでした。"
          onRetry={() => void onRetry()}
        />
      );
    case "ready":
      if (view.connections.length === 0)
        return (
          <div className="settings-group">
            <p className="settings-row settings-empty">接続中のアプリはありません。</p>
          </div>
        );
      return (
        <ul className="settings-group">
          {view.connections.map(({ clientId, name }) => {
            const publisher = clientPublisher(clientId);
            const displayName = name ?? publisher ?? clientId;
            return (
              <li key={clientId} className="settings-row">
                <span className="settings-row-text">
                  <span className="settings-row-title">{displayName}</span>
                  <span className="settings-row-detail">{publisher ?? "提供元は未確認"}</span>
                </span>
                <Button
                  variant="ghost"
                  disabled={busy}
                  aria-label={`${displayName} の接続を解除`}
                  onClick={() => void onRevoke(clientId)}
                >
                  解除
                </Button>
              </li>
            );
          })}
        </ul>
      );
    default: {
      const exhausted: never = view;
      return exhausted;
    }
  }
}
