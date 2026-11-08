import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TokenPanel } from "./token-panel";
import { auth } from "void/client";
import { Button } from "@/components/ui/button";

export function AuthGate({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function signOut() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await auth.signOut();
      if (result.error) setError("ログアウトできませんでした。再試行してください。");
      else await session.refetch();
    } catch {
      setError("通信に失敗しました。再試行してください。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (session.isPending) return <p role="status">ログイン状態を確認中…</p>;
  if (session.denied)
    return (
      <main className="workspace">
        <p role="alert">このアカウントにはアクセスが許可されていません。</p>
        <Button disabled={busy} onClick={() => void signOut()}>
          ログアウト
        </Button>
        {error && <p role="alert">{error}</p>}
      </main>
    );
  if (session.error)
    return (
      <main className="workspace">
        <p role="alert">認証サービスに接続できませんでした。</p>
        <Button onClick={() => void session.refetch()}>再試行</Button>
      </main>
    );
  if (!session.data) return <SignIn />;
  return (
    <>
      <div className="workspace flex items-center justify-between gap-4">
        <span>{session.data.user.email}</span>
        <Button variant="outline" disabled={busy} onClick={() => void signOut()}>
          ログアウト
        </Button>
        {error && <p role="alert">{error}</p>}
      </div>
      {!busy && (
        <div key={session.data.user.id}>
          {children}
          <TokenPanel />
        </div>
      )}
    </>
  );
}

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function signIn(provider: "github" | "google") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await auth.signIn.social({ provider, callbackURL: "/" });
      if (result.error) setError("ログインできませんでした。管理者の認証設定を確認してください。");
    } catch {
      setError("通信に失敗しました。再試行してください。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="workspace">
      <h1>Pocket にログイン</h1>
      <p className="workspace-description">
        管理者が許可したGoogleまたはGitHubアカウントでログインしてください。
      </p>
      <div className="task-composer grid gap-3">
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy} onClick={() => void signIn("github")}>
          GitHubでログイン
        </Button>
        <Button disabled={busy} onClick={() => void signIn("google")}>
          Googleでログイン
        </Button>
        {busy && <p role="status">ログイン画面に移動中…</p>}
      </div>
    </main>
  );
}

function useAuthSession() {
  type Session = Awaited<ReturnType<typeof auth.getSession>>["data"];
  const [data, setData] = useState<Session>(null);
  const [error, setError] = useState(false);
  const [isPending, setPending] = useState(true);
  const [denied, setDenied] = useState(false);
  const requestId = useRef(0);
  const refetch = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setPending(true);
    setDenied(false);
    try {
      const result = await auth.getSession();
      if (currentRequest !== requestId.current) return;
      if (result.data && !result.error) {
        const access = await fetch("/api/access", { cache: "no-store" });
        if (currentRequest !== requestId.current) return;
        setDenied(access.status === 401 || access.status === 403);
        setError(!access.ok);
      } else setError(Boolean(result.error));
      setData(result.data);
    } catch {
      if (currentRequest !== requestId.current) return;
      setData(null);
      setError(true);
    } finally {
      if (currentRequest === requestId.current) setPending(false);
    }
  }, []);
  useEffect(() => {
    void refetch();
    const refresh = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      requestId.current += 1;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refetch]);
  return { data, error, denied, isPending, refetch };
}
