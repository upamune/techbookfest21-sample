import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { auth } from "void/client";
import { Button } from "@pocket/ui/button";
import { ErrorNotice } from "@pocket/ui/feedback";
import { Skeleton } from "@pocket/ui/skeleton";
import { TokenPanel } from "./token-panel";

type Account = { email: string; busy: boolean; error: string | null; signOut: () => void };

const AccountContext = createContext<Account | null>(null);

export function AccountPanel() {
  const account = use(AccountContext);
  if (account === null) return null;
  return (
    <section className="account-panel" aria-label="アカウント">
      <div className="account-row">
        <span>{account.email}</span>
        <Button variant="outline" disabled={account.busy} onClick={account.signOut}>
          ログアウト
        </Button>
      </div>
      {account.error && <ErrorNotice message={account.error} />}
      <TokenPanel />
    </section>
  );
}

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
  if (session.isPending)
    return (
      <main className="page signin">
        <p role="status" className="sr-only">
          ログイン状態を確認中…
        </p>
        <Skeleton className="skeleton-line" style={{ width: "40%" }} />
        <Skeleton className="skeleton-line" />
      </main>
    );
  if (session.denied)
    return (
      <main className="page signin">
        <p role="alert">このアカウントにはアクセスが許可されていません。</p>
        <Button disabled={busy} onClick={() => void signOut()}>
          ログアウト
        </Button>
        {error && <ErrorNotice message={error} />}
      </main>
    );
  if (session.error)
    return (
      <main className="page signin">
        <ErrorNotice
          message="認証サービスに接続できませんでした。"
          onRetry={() => void session.refetch()}
        />
      </main>
    );
  if (!session.data) return <SignIn />;
  if (busy) return null;
  return (
    <AccountContext
      key={session.data.user.id}
      value={{
        email: session.data.user.email,
        busy,
        error,
        signOut: () => void signOut(),
      }}
    >
      {children}
    </AccountContext>
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
    <main className="page signin">
      <h1>Pocket にログイン</h1>
      <p>管理者が許可したGoogleまたはGitHubアカウントでログインしてください。</p>
      {error && <ErrorNotice message={error} />}
      <Button disabled={busy} onClick={() => void signIn("github")}>
        GitHubでログイン
      </Button>
      <Button disabled={busy} onClick={() => void signIn("google")}>
        Googleでログイン
      </Button>
      {busy && <p role="status">ログイン画面に移動中…</p>}
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
