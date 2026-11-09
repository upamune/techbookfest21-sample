# 認証付き公開の準備

このコミットは公開準備です。公開URL、Cloudflare資源、実アカウント、実アクセストークンは作成していません。`POCKET_AUTH_ENABLED` は既定で `false` です。認証なしで本番API/MCPを開くためにこの境界を削除しないでください。

## データと権限

- ローカル開発のデータは `owner_id=local`。既存データを勝手にアカウントへ割り当てません。
- ブラウザはVoid標準Better AuthとGitHub/Google OAuthで認証します。メール/パスワード登録は無効です。許可された利用者の初回OAuthログイン時にアプリのアカウントが作られます。許可表の既定値は空で、誰もログインできません。メールアドレスや表示名を許可判定に使いません。
- 本番データは `user:<認証済みID>` で分離し、一覧・変更・削除すべてに所有者条件を付けます。
- API/MCP用トークンはブラウザの明示的な発行操作だけで作ります。トークン自身には追加トークンを作成する権限がありません。
- トークンは32バイトの暗号学的乱数、30日有効、DBにはSHA-256のみ保存。本文の秘密値は発行時の一度だけ返し、後から一覧で復元できません。
- トークンはそのユーザーのアプリのデータの閲覧・作成・変更・削除を許可します。失効APIは所有者だけが利用でき、以降のリクエストで無効になります。アカウント削除後も利用できません。
- 本番アクセスのスイッチが無効なら、セッション・トークンがあってもAPI/MCPを利用できません。

## 公開前に必要な承認と設定

1. 利用するCloudflareアカウントとWorker/D1/R2作成、公開範囲、料金条件を確認します。
2. `void cloudflare login` の権限内容を確認して認証します。OAuthやAPIトークン作成など持続的アクセスの承認を、単なるコードpushの承認で代用しません。
3. 利用するproviderのOAuth client登録とclient secret発行・保存、本番認証secretの保存を個別に承認します。callbackはGitHubが `https://<実際の配備ホスト>/api/auth/callback/github`、Googleが `https://<実際の配備ホスト>/api/auth/callback/google` です。GoogleはCloud Consoleで同意画面とWeb OAuth clientを設定します。既存OAuth Appを流用する場合も対象とcallback変更の影響を確認します。secretをチャット、Git、コマンド引数へ貼り付けません。

   同梱GitHub providerの既定scopeは `read:user` と `user:email` です。ログイン時にユーザープロフィールとメールをこのアプリが受け取ることを確認し、GitHub側の認可画面で実際の要求権限を確認してください。

4. `void connect --platform cloudflare` で対象を確認し、`void deploy --platform cloudflare` が作成する資源を確認します。Voidは初回に資源を作成するため、承認前にdeployを実行しません。
5. 認証テーブル・所有者列・アクセストークン表のmigrationをレビューして適用します。既存DBへ適用する際はバックアップと復旧手順を確保してください。
6. `BETTER_AUTH_SECRET`と、使うproviderの `AUTH_GITHUB_CLIENT_ID` / `AUTH_GITHUB_CLIENT_SECRET` または `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET` を秘密管理経由で設定します。Voidが認証secretを自動作成することにも事前の承認が必要です。`POCKET_AUTH_ENABLED=true` は公開確認後に設定します。gateまたは各providerの資格情報が未設定の場合、そのproviderは無効のままです。
7. 作成された `void.lock.json` の資源IDを保存します。秘密値は含めません。自動デプロイのためのCI資格情報は、この変更では作りません。

## Remote CLI / MCP

公開後、ブラウザへログインし「API・MCP・CLI」で権限を読んでトークンを発行します。トークンは秘密管理から環境変数 `POCKET_TOKEN` へ渡します。URLは実際に確認した自分の公開先を指定します。

```sh
export POCKET_URL=https://your-verified-worker.example/mcp
# POCKET_TOKEN は秘密管理から設定する
npm run pocket -- list
npm run pocket -- call forum_list_threads '{}'
npm run pocket -- call things_add_item '{"requestId":"生成したUUID","name":"公開版の確認"}' --confirm
```

CLIはURLとトークン両方が指定された場合のみremoteに接続します。HTTPS、正確な `/mcp`、userinfo・query・fragmentなしが必須です。リダイレクトと自動再接続を拒否し、書込みを自動再送しません。標準MCPクライアントでは同じURLに `Authorization: Bearer <token>` を設定します。HTTP APIも同じBearerヘッダーを使用します。トークンをURLへ入れないでください。

## MCP OAuth

`POCKET_AUTH_ENABLED=true`にすると、CIMDとDynamic Client Registrationが有効になります。`false`の間はどちらも拒否し、外部への取得もしません。

- `/.well-known/oauth-protected-resource/mcp`と`/.well-known/oauth-authorization-server/api/auth`を公開します。
- アクセストークンはEdDSA署名のJWTで、有効期限は1時間です。aud が`<公開先>/mcp`、scope に`mcp:tools`を含むものだけを受け付け、毎回許可表と照合します。REST APIには使えません。
- 公開先の`resource`はHTTPS必須です。HTTPはloopbackでだけ動きます。
- CIMD文書の取得はCloudflare Workersの`fetch`で行い、接続先IPの固定はできません。`POCKET_CIMD_ALLOWED_HOSTS`の完全一致とリダイレクト拒否で、取得先を信頼できるホストに限定しています。このリストを任意のホストへ広げないでください。
- DCRは認証なしで登録できます。登録された名前は自己申告なので、同意画面では「未確認」と表示します。
- DPoPで拘束されたトークンには未対応で、401を返します。

## 公開後の受け入れ確認

- 未認証API/MCPが401、gate無効時は503になる。
- 未認証の`/mcp`が`WWW-Authenticate`を返し、許可したクライアントだけがOAuthで接続できる。
- 2アカウントで一覧・更新・削除が交差せず、推測した他人のUUIDでも操作できない。
- Web作成をAPI/MCP/CLIから確認でき、逆方向も同じデータになる。
- token失効・期限切れ・アカウント削除後に401になる。
- tokenでtoken発行/失効ができず、別originからのブラウザ書込みを拒否する。
- モバイルを含むブラウザ操作と、ログアウト後のデータ非表示を確認する。

GitHub/Googleの本番ログイン・資源作成・公開URLでの動作はまだ未検証です。ローカルの成功を本番の成功とは扱いません。

## 許可表

`POCKET_ALLOWED_GITHUB_IDS` はGitHubの不変数値ID文字列のJSON配列、`POCKET_ALLOWED_GOOGLE_SUBS` はGoogleの不変subject文字列のJSON配列です。両方とも既定は `[]`。許可対象は設定していません。不正JSON・不正要素も全拒否します。provider間で同じ値でも別の本人識別子です。Googleのテスト利用者設定やメールドメイン制限をこの許可表の代わりにはしません。

OAuthプロフィール取得後とアカウント作成前に許可判定し、既存セッション・トークンでも各API/MCP要求ごとに再確認します。許可を外すと次の要求からアクセスできません。トークンの永久失効は別途失効操作で行います。アカウントの自動連携は無効です。許可対象の本人IDと管理方法は、利用者の明示的な指示を受けてから設定します。

Googleのscopeは基本ログインの `openid` / `email` / `profile` のみで、Gmail・Drive権限は要求しません。公開状態やブランド設定に応じたGoogle側の確認事項は、実際のConsoleで確認してください。
