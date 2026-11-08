import { useRef, useState } from "react";
import { z } from "zod";
import { jsonRequest, request } from "@pocket/tools/request";
import { Button } from "@pocket/ui/button";
import { Input } from "@pocket/ui/input";

const tokenInfo = z.object({
  id: z.string().uuid(),
  name: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
});
const tokenList = z.object({ tokens: z.array(tokenInfo) });
const issuedToken = z.object({ token: z.object({ secret: z.string() }) });

export function TokenPanel() {
  const [tokens, setTokens] = useState<z.infer<typeof tokenInfo>[]>([]);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function refresh() {
    const result = await request({ path: "/api/tokens", schema: tokenList });
    setTokens(result.tokens);
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("処理を確認できませんでした。再送せず、一覧を更新して確認してください。");
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
    <section aria-label="API・MCPアクセストークン">
      <h2>API・MCP・CLI</h2>
      <p>
        トークンはあなたのアプリのデータの閲覧・作成・変更・削除を許可します。有効期限は30日です。
      </p>
      <label htmlFor="token-name">用途</label>
      <Input
        id="token-name"
        value={name}
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
        disabled={busy}
      />
      <Button disabled={busy || !name.trim()} onClick={() => void run(issue)}>
        権限を確認してトークンを発行
      </Button>
      <Button disabled={busy} onClick={() => void run(refresh)}>
        一覧を更新
      </Button>
      {secret !== null && (
        <div>
          <p>
            この画面で一度だけ表示します。安全な場所に保存し、チャットやソースコードへ貼り付けないでください。
          </p>
          <Input aria-label="発行されたトークン" readOnly value={secret} />
          <Button onClick={() => setSecret(null)}>表示を閉じる</Button>
        </div>
      )}
      {error !== null && <p role="alert">{error}</p>}
      <ul>
        {tokens.map((token) => (
          <li key={token.id} className="token-row">
            {token.name} / 期限 {token.expiresAt.slice(0, 10)} /{" "}
            {token.revokedAt !== null
              ? "失効済み"
              : Date.parse(token.expiresAt) <= Date.now()
                ? "期限切れ"
                : "有効"}
            <Button
              disabled={busy || token.revokedAt !== null}
              onClick={() => void run(() => revoke(token.id))}
            >
              失効
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
