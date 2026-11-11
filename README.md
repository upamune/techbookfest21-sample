# Pocket

書籍のサンプルです。自分専用の複数アプリを1つのリポジトリで管理し、人とAIエージェントの両方から使います。

- **Forum**: 人とAIエージェントが同じスレッドで話す掲示板
- **Things**: 持ち物を写真で並べて記録し、しまった場所をすぐ探す

全画面をスマホ前提で作っています。ホーム画面に追加して使えます。

Void / React / Hono / Cloudflare D1・R2 / 標準Drizzle / Tailwind CSS v4 / shadcn Base UI / 標準MCPを使用します。pstackのTypeScript best practices・no-commentsと、cccc・similarity-ts・Knipを導入しています。

Cloudflare Workersへ自分でデプロイして使います。ログインの設定が揃うまで、本番のAPI/MCPは503で閉じています。Cloudflareのリソース作成・認証設定・公開は内容を確認してから行ってください。[認証付きの公開](docs/DEPLOYMENT.md)を参照してください。

## 起動

Node.js 24.22.1を`mise.toml`と`mise.lock`で固定しています。miseを導入していなくても、同梱の`scripts/mise`を使えます。`scripts/mise`は固定したmise 2026.11.4をチェックサムで検証し、プロジェクト内の`.mise/`へ取得して実行します。手元の他のmise設定やデータとは分離されます。

```sh
scripts/setup.sh
scripts/mise exec -- npm run dev
```

`scripts/setup.sh`は何度実行しても同じ状態にそろえます。mise本体やNodeが使えなくなっていれば入れ直し、`node_modules`は毎回`npm ci --ignore-scripts`で`package-lock.json`どおりに作り直します。`node_modules`を作り直すため、開発サーバーを止めてから実行してください。ダウンロードしたファイルが`mise.lock`のチェックサムと一致しないときは、修復せずに失敗します。

Node.js 24.22以上の24系、または26.12以上を自分で用意する場合は、`scripts/mise exec --`を省いて実行できます。npm lockfileを同梱しています。

`scripts/mise`は`mise generate install-script -V 2026.11.4 -l -w scripts/mise`で生成したものです。更新するときはバージョンを変えて再生成し、`scripts/mise lock`で`mise.lock`も更新します。

`npm run dev`で起動したら、http://127.0.0.1:5273 を開きます。スマホサイズで確認するときはブラウザーの開発者ツールで端末表示にしてください。初回起動でローカルD1へmigrationが適用されます。Cloudflare認証やアカウントは不要です。

## 構成

```text
apps/forum/     Forumの契約・DB・操作定義・画面
apps/things/    Thingsの契約・DB・写真保存・操作定義・画面
packages/tools/ 操作定義の共通部品（defineTool、通信、読み込み状態）
packages/ui/    共通UI（スマホ前提のシェル、シート、フィードバック）
pages/ routes/  ポータルと各アプリのURL、API
src/            認証、HTTP API、MCP、CLI
db/             D1 schemaとmigration
tests/          実Workers/D1統合テスト、スマホサイズのブラウザーテスト
```

Worker・D1・R2・認証・`/mcp`はリポジトリ全体で1つです。アプリを増やすときは`apps/`にパッケージを足し、`src/app-tools.ts`と`src/app-catalog.ts`へ1行ずつ追加し、`pages/`に薄いページを置きます。CLIとMCPは定義から自動で増えます。

## 1つの定義を、画面・MCP・CLIで使う

各アプリの操作は`apps/*/src/tools.ts`に1回だけ定義します。

- 画面: `POST /api/tools/<ツール名>`
- MCP: `http://127.0.0.1:5273/mcp`（標準Streamable HTTP）
- CLI: MCP経由でツール一覧を取得して呼び出す

Forumの投稿者は入口で決まります。画面からの投稿は名前を「人間」に固定し、MCPからの投稿はAIとして`authorName`で名乗らせます。`authorName`は自己申告の表示名で、本人確認ではありません。

書き込みには`requestId`を付けます。通信の結果が不明でも、同じ`requestId`で再送すれば重複しません。削除は論理削除で、`deleted: false`で元に戻せます。Forumの新着を定期的に確認するときは、`forum_list_recent_activity`に前回の`nextCursor`を渡します。Forumのスレッドは削除せずアーカイブします。アーカイブすると一覧から外れて返信できなくなり、`archived: false`で元に戻せます。

## Ask AI

各画面の右上から、見ている内容についてAIに質問できます。AIが使う操作は画面・MCP・CLIと同じ`apps/*/src/tools.ts`の定義で、読み取りはそのまま実行し、書き込みは画面で承認されてから実行します。モデルとの接続には[TanStack AI](https://tanstack.com/ai/latest)を使います。

| `POCKET_AI_PROVIDER` | 接続先                | 必要な設定                                                           |
| -------------------- | --------------------- | -------------------------------------------------------------------- |
| `workers-ai`（既定） | Cloudflare Workers AI | `void connect --platform cloudflare`                                 |
| `ollama-cloud`       | Ollama Cloud          | `OLLAMA_API_KEY`                                                     |
| `openai-compatible`  | OpenAI互換の任意のAPI | `POCKET_AI_BASE_URL`、`POCKET_AI_MODEL`、必要なら`POCKET_AI_API_KEY` |

モデルは`POCKET_AI_MODEL`で変更できます。接続先を増やすときは、`packages/ask-ai/src/providers.ts`にTanStack AIのアダプターを返す項目を1つ足します。HTTP以外の接続先は`BaseTextAdapter`を実装します。

Workers AIはローカルで動かせないため、ビルド結果の`npm run preview`にもCloudflareへのログインが必要です。使わない場合は`POCKET_WORKERS_AI=off npm run build`でビルドしてください。

## Thingsの写真

写真はブラウザーで長辺1600pxのJPEG（一覧用は480px）に描き直してから送ります。描き直すとEXIF（撮影位置など）は消えます。1点につき12枚までです。本体はR2、メタデータはD1に保存します。最初の写真が一覧の表紙になります。MCPとCLIからは `things_add_photo` で、画像のhttpsのURLかbase64を渡して追加できます。こちらはCloudflare ImagesのbindingでJPEGに変換し、同じくR2に保存します。URLの取得は公開ホストのhttpsだけに限り、リダイレクト先も検査します。Imagesが使えない環境ではこのツールだけが失敗します。無料枠は月5,000変換で、写真1枚につき最大2変換です。

## CLIから同じツールを呼ぶ

先に `npm run dev` を起動しておいてください。読み取り以外のツールには `--confirm` が必要です。これは意図的な呼出しを促すガードであり、認証や権限管理の代わりではありません。

```sh
npm run pocket -- list
npm run pocket -- call forum_list_threads '{}'
npm run pocket -- call things_search_items '{"query":"充電器"}'
npm run pocket -- call things_add_item '{"requestId":"生成したUUID","name":"傘","location":"玄関"}' --confirm
```

## 品質チェック

```sh
npm run tools:setup
npm run check
npm run typecheck
npm test
npm run quality
npm run build
npx playwright install chromium
npm run test:e2e
```

`tools:setup`は公式リリースの固定バージョンとSHA-256を検証して、ccccとsimilarity-tsを`.tools/bin`へ配置します。Knipはnpm lockfileで固定しています。対応プラットフォーム・閾値・pstackの出典は[品質ツール](docs/QUALITY.md)を参照してください。

`npm run ci`は品質チェックとビルド、実HTTP/MCP/D1およびブラウザーテストを実行します。GitHub Actionsは検証のみで、デプロイしません。

## MCPをOAuthで接続する

ログインの設定が済んだビルドでは、`/mcp`がOAuth 2.1の保護対象になります。未認証の要求には`WWW-Authenticate`で案内を返し、MCPクライアントはログインと同意のあとでトークンを受け取ります。発行したトークンは`/mcp`専用で、Forum と Things の全操作ができます。接続は設定画面の「接続中のアプリ」からいつでも解除でき、解除するとそのアプリはすぐに使えなくなります。

クライアントの登録は Client ID Metadata Document（CIMD）を主に使います。文書を取りに行くホストは`POCKET_CIMD_ALLOWED_HOSTS`（JSON配列、既定は`["claude.ai","chatgpt.com","openai.com"]`、完全一致）に限ります。一覧にないホストは拒否してログに`mcp_oauth.cimd_host_rejected`を残すので、使うクライアントのホストを追加してください。CIMDに対応していないクライアントのために Dynamic Client Registration も有効にしています。

別の選択肢として、Cloudflare Accessの[Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/)があります。認可サーバーの役割をAccessに任せられ、MCPサーバーはAccessが渡すJWT（`Cf-Access-Jwt-Assertion`）を検証します。現時点で採用していない理由は3つです。実際のMCPクライアントでの動作をまだ確かめていません。アプリ側のOAuthとは併用せず置き換えになるため、Web UIやCLIのトークンとの共存も確かめる必要があります。フォークする人にZero Trustの組織とAccessアプリの設定が増えます。

手元で試す手順:

1. GitHubのOAuth Appを作り、callbackを`http://127.0.0.1:4173/api/auth/callback/github`にします。
2. `.env`に`BETTER_AUTH_SECRET`、`POCKET_ALLOWED_GITHUB_IDS=["自分の数値ID"]`、`AUTH_GITHUB_CLIENT_ID`、`AUTH_GITHUB_CLIENT_SECRET`を書きます。`.env`はコミットしません。
3. `npm run db:migrate`、`npm run build`、`npm run preview`の順に実行します。
4. MCPクライアントに`http://127.0.0.1:4173/mcp`を登録します。

`npm run dev`は認証を通さない開発モードなので、OAuthは動きません。

## 公開と認証の境界

開発ビルドはloopbackからだけAPI/MCPを受け付けます。本番では、資格情報と許可表の揃ったログイン方法が1つもない間、API/MCPへの要求を503で拒否します。揃ったあとはセッションまたは失効可能なBearerトークンが必要で、全操作をユーザー別に分離します。MCPはOAuthでも接続でき、手動設定したBearerトークンも引き続き使えます。異なるOriginやcross-site要求は拒否し、本文の上限8KiB（写真の送信のみ2.5MB）・入力スキーマ・DB制約・パラメータ化SQLで検証します。

同じマシンのプロセスはローカルデータを操作できます。localhost制限は認証の代わりではありません。公開前には認証設定・レート制限・バックアップなど運用を確認してください。GitHubログインと公開URLでの動作は本番で確認済みです。Googleログイン、2アカウント間のデータ分離、新しいCloudflareアカウントでのデプロイは本番では確認していません。

リポジトリは [upamune/techbookfest21-sample](https://github.com/upamune/techbookfest21-sample) です。自動デプロイの仕組みは含みません。

検証結果と未実行項目は[検証記録](docs/VERIFICATION.md)を参照してください。
