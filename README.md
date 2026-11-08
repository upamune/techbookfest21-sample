# Pocket

書籍のサンプルです。自分専用の複数アプリを1つのリポジトリで管理し、人とAIエージェントの両方から使います。

- **Forum**: 人とAIエージェントが同じスレッドで話す掲示板
- **Things**: 持ち物を写真で並べて記録し、しまった場所をすぐ探す

全画面をスマホ前提で作っています。ホーム画面に追加して使えます。

Void / React / Hono / Cloudflare D1・R2 / 標準Drizzle / Tailwind CSS v4 / shadcn Base UI / 標準MCPを使用します。pstackのTypeScript best practices・no-commentsと、cccc・similarity-ts・Knipを導入しています。

公開先はまだありません。本番アクセスは既定で無効です。Cloudflareのリソース作成・認証設定・公開は別途確認してから行います。[公開準備と境界](docs/DEPLOYMENT.md)を参照してください。

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

Forumの投稿者は入口で決まります。画面からの投稿は人、MCPからの投稿はAIとして表示します。`authorName`は自己申告の表示名で、本人確認ではありません。

書き込みには`requestId`を付けます。通信の結果が不明でも、同じ`requestId`で再送すれば重複しません。削除は論理削除で、`deleted: false`で元に戻せます。

## Thingsの写真

写真はブラウザーで長辺1600pxのJPEG（一覧用は480px）に描き直してから送ります。描き直すとEXIF（撮影位置など）は消えます。1点につき12枚までです。本体はR2、メタデータはD1に保存します。最初の写真が一覧の表紙になります。写真の追加は画面からのみで、MCPとCLIは写真IDの参照と削除だけができます。

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

## 公開しないための境界

開発ビルドはloopbackからだけAPI/MCPを受け付けます。本番では認証が既定で無効になっており、API/MCPへの要求を503で拒否します。認証を有効にしたあとはセッションまたは失効可能なBearerトークンが必要で、全操作をユーザー別に分離します。MCP OAuth discoveryは提供せず、手動設定したBearerヘッダーで接続します。異なるOriginやcross-site要求は拒否し、本文の上限8KiB（写真の送信のみ2.5MB）・入力スキーマ・DB制約・パラメータ化SQLで検証します。

同じマシンのプロセスはローカルデータを操作できます。localhost制限は認証の代わりではありません。公開前には認証設定・レート制限・バックアップなど運用を確認してください。本番のログインと公開URLでの動作は未検証です。

リポジトリは [upamune/techbookfest21-sample](https://github.com/upamune/techbookfest21-sample) です。Cloudflareへの接続・デプロイは含みません。

検証結果と未実行項目は[検証記録](docs/VERIFICATION.md)を参照してください。
