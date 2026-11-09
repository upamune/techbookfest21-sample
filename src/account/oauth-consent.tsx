import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@pocket/ui/button";
import { ErrorNotice } from "@pocket/ui/feedback";
import { Skeleton } from "@pocket/ui/skeleton";
import { z } from "zod";
import { oauthAuthClient } from "./oauth-client";

const publicClient = z.object({ client_id: z.string(), client_name: z.string().optional() });
const consentResult = z.object({ url: z.string() });
type Client = { name: string; publisher: string | null; returnsTo: string };
type View =
  | { kind: "loading" }
  | { kind: "notice"; message: string }
  | { kind: "ready"; client: Client };
const invalidRequest: View = {
  kind: "notice",
  message: "接続の要求が無効か、期限が切れています。接続元のアプリからやり直してください。",
};

function hostOf(value: string) {
  return URL.canParse(value) ? new URL(value).host : null;
}

function toClient(client: z.infer<typeof publicClient>, redirectUri: string): Client {
  const publisher = client.client_id.startsWith("https://") ? hostOf(client.client_id) : null;
  return {
    name: client.client_name ?? publisher ?? "名前のないアプリ",
    publisher,
    returnsTo: hostOf(redirectUri) ?? redirectUri,
  };
}

async function loadClient(search: string): Promise<View> {
  const query = new URLSearchParams(search);
  const clientId = query.get("client_id");
  const redirectUri = query.get("redirect_uri");
  if (clientId === null || redirectUri === null || !query.has("sig")) return invalidRequest;
  const response = await fetch(
    `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId })}`,
    { cache: "no-store" },
  );
  if (!response.ok) return invalidRequest;
  return {
    kind: "ready",
    client: toClient(publicClient.parse(await response.json()), redirectUri),
  };
}

export function OAuthConsent() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [decisionFailed, setDecisionFailed] = useState(false);

  useEffect(() => {
    let current = true;
    void loadClient(window.location.search)
      .catch((): View => ({ kind: "notice", message: "接続元のアプリを確認できませんでした。" }))
      .then((next) => {
        if (current) setView(next);
      });
    return () => {
      current = false;
    };
  }, []);

  async function decide(accept: boolean) {
    setBusy(true);
    setDecisionFailed(false);
    const { data } = await oauthAuthClient.$fetch("/oauth2/consent", {
      method: "POST",
      body: { accept },
    });
    const result = consentResult.safeParse(data);
    if (result.success) {
      window.location.assign(result.data.url);
      return;
    }
    setBusy(false);
    setDecisionFailed(true);
  }

  switch (view.kind) {
    case "loading":
      return (
        <ConsentLayout
          title={<TextSkeleton width="70%" />}
          publisher={<TextSkeleton width="40%" />}
          returnsTo={<TextSkeleton width="40%" />}
          decisionFailed={false}
          disabled
          onDecide={decide}
        />
      );
    case "notice":
      return <ConsentNotice message={view.message} />;
    case "ready":
      return (
        <ConsentLayout
          title={`${view.client.name} を接続しますか？`}
          publisher={view.client.publisher ?? "未確認（名前はアプリの自己申告です）"}
          returnsTo={view.client.returnsTo}
          decisionFailed={decisionFailed}
          disabled={busy}
          onDecide={decide}
        />
      );
    default: {
      const exhausted: never = view;
      return exhausted;
    }
  }
}

function TextSkeleton({ width }: { width: string }) {
  return <Skeleton className="oauth-consent-skeleton" style={{ width }} />;
}

function ConsentNotice({ message }: { message: string }) {
  return (
    <main className="page signin oauth-consent">
      <ErrorNotice message={message} />
    </main>
  );
}

function ConsentLayout({
  title,
  publisher,
  returnsTo,
  decisionFailed,
  disabled,
  onDecide,
}: {
  title: ReactNode;
  publisher: ReactNode;
  returnsTo: ReactNode;
  decisionFailed: boolean;
  disabled: boolean;
  onDecide: (accept: boolean) => Promise<void>;
}) {
  return (
    <main className="page signin oauth-consent">
      <h1>{title}</h1>
      <p>許可すると、このアプリは Forum と Things のすべてのデータを読み書きできます。</p>
      <dl className="oauth-consent-facts">
        <div>
          <dt>提供元</dt>
          <dd>{publisher}</dd>
        </div>
        <div>
          <dt>許可後の戻り先</dt>
          <dd>{returnsTo}</dd>
        </div>
      </dl>
      {decisionFailed && <ErrorNotice message="送信できませんでした。再試行してください。" />}
      <div className="oauth-consent-actions">
        <Button variant="outline" disabled={disabled} onClick={() => void onDecide(false)}>
          拒否する
        </Button>
        <Button disabled={disabled} onClick={() => void onDecide(true)}>
          許可する
        </Button>
      </div>
    </main>
  );
}
