import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { jsonRequest, request } from "@pocket/tools/request";
import { Button } from "@pocket/ui/button";
import { ErrorNotice } from "@pocket/ui/feedback";
import { Input } from "@pocket/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from "@pocket/ui/sheet";
import { Skeleton } from "@pocket/ui/skeleton";

const tokenInfo = z.object({
  id: z.string().uuid(),
  name: z.string(),
  expiresAt: z.string(),
});
const tokenList = z.object({ tokens: z.array(tokenInfo) });
const issuedToken = z.object({ token: z.object({ secret: z.string() }) });
type Token = z.infer<typeof tokenInfo>;
type View = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; tokens: Token[] };

function tokenStatus({ expiresAt }: Token) {
  return Date.parse(expiresAt) <= Date.now() ? "期限切れ" : "有効";
}

export function TokenPanel() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<Token | null>(null);
  const lock = useRef(false);

  async function refresh() {
    const { tokens } = await request({ path: "/api/tokens", schema: tokenList });
    setView({ kind: "ready", tokens });
  }
  async function load() {
    setView({ kind: "loading" });
    try {
      await refresh();
    } catch {
      setView({ kind: "failed" });
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("処理を確認できませんでした。再送せず、ページを開き直して確認してください。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function issue() {
    setSecret(null);
    const result = await request({
      path: "/api/tokens",
      schema: issuedToken,
      init: jsonRequest({ method: "POST", body: { name } }),
    });
    setSecret(result.token.secret);
    setName("");
    await refresh();
  }
  async function revoke(id: string) {
    setSecret(null);
    await request({
      path: `/api/tokens/${id}`,
      schema: z.object({ revoked: z.boolean() }),
      init: { method: "DELETE" },
    });
    await refresh();
  }
  return (
    <section className="settings-section" aria-label="API・MCPアクセストークン">
      <h2>API・MCP・CLI</h2>
      <p className="settings-note">
        トークンはあなたのアプリのデータの閲覧・作成・変更・削除を許可します。有効期限は30日です。
      </p>
      <form
        className="token-form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(issue);
        }}
      >
        <label htmlFor="token-name">用途</label>
        <div className="token-form-controls">
          <Input
            id="token-name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            トークンを発行
          </Button>
        </div>
      </form>
      {secret !== null && (
        <div className="token-secret">
          <p>
            この画面で一度だけ表示します。安全な場所に保存し、チャットやソースコードへ貼り付けないでください。
          </p>
          <Input aria-label="発行されたトークン" readOnly value={secret} />
          <Button variant="outline" onClick={() => setSecret(null)}>
            表示を閉じる
          </Button>
        </div>
      )}
      {error !== null && <ErrorNotice message={error} />}
      <TokenRows view={view} busy={busy} onRevoke={setPendingRevoke} onRetry={() => void load()} />
      <RevokeConfirmation
        token={pendingRevoke}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={(id) => {
          setPendingRevoke(null);
          void run(() => revoke(id));
        }}
      />
    </section>
  );
}

function RevokeConfirmation({
  token,
  onCancel,
  onConfirm,
}: {
  token: Token | null;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Sheet open={token !== null} onOpenChange={(open) => !open && onCancel()}>
      <SheetContent role="alertdialog" initialFocus={cancel}>
        <SheetTitle>トークンを失効しますか？</SheetTitle>
        <SheetDescription>
          「{token?.name}」を使っている接続はすぐに使えなくなります。元には戻せません。
        </SheetDescription>
        <SheetFooter>
          <Button ref={cancel} variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={() => token !== null && onConfirm(token.id)}>
            失効する
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TokenRows({
  view,
  busy,
  onRevoke,
  onRetry,
}: {
  view: View;
  busy: boolean;
  onRevoke: (token: Token) => void;
  onRetry: () => void;
}) {
  switch (view.kind) {
    case "loading":
      return (
        <div className="settings-group">
          <div className="settings-row">
            <p role="status" className="sr-only">
              トークンを読み込み中…
            </p>
            <span className="settings-row-text">
              <Skeleton className="oauth-consent-skeleton" style={{ width: "50%" }} />
              <Skeleton className="oauth-consent-skeleton" style={{ width: "35%" }} />
            </span>
          </div>
        </div>
      );
    case "failed":
      return <ErrorNotice message="トークンを読み込めませんでした。" onRetry={onRetry} />;
    case "ready":
      if (view.tokens.length === 0)
        return (
          <div className="settings-group">
            <p className="settings-row settings-empty">発行したトークンはありません。</p>
          </div>
        );
      return (
        <ul className="settings-group">
          {view.tokens.map((token) => (
            <li key={token.id} className="settings-row">
              <span className="settings-row-text">
                <span className="settings-row-title">{token.name}</span>
                <span className="settings-row-detail">
                  {tokenStatus(token)} · 期限 {token.expiresAt.slice(0, 10)}
                </span>
              </span>
              <Button
                variant="destructive"
                disabled={busy}
                aria-label={`${token.name} を失効`}
                onClick={() => onRevoke(token)}
              >
                失効
              </Button>
            </li>
          ))}
        </ul>
      );
    default: {
      const exhausted: never = view;
      return exhausted;
    }
  }
}
