# Void Task Lab

技術書の構成検証用サンプルです。タスクCRUDは仮題材で、書籍の最終題材ではありません。

ローカル実行に加え、認証付きWeb・API・MCP・CLIの公開準備を実装しています。公開先はまだありません。本番アクセスは既定で無効です。Cloudflareのリソース作成・認証設定・公開は別途確認してから行います。[公開準備と境界](docs/DEPLOYMENT.md)を参照してください。

Void / React / Hono / Cloudflare D1 / 標準Drizzle / Tailwind CSS v4 / shadcn Base UI / 標準MCPを使用します。pstackのTypeScript best practices・no-commentsと、cccc・similarity-ts・Knipを導入しています。

## 起動

Node.js 24.22.1を`mise.toml`と`mise.lock`で固定しています。miseを導入していなくても、同梱の`scripts/mise`を使えます。`scripts/mise`は固定したmise 2026.11.4をチェックサムで検証し、プロジェクト内の`.mise/`へ取得して実行します。手元の他のmise設定やデータとは分離されます。

```sh
scripts/setup.sh
scripts/mise exec -- npm run dev
```

`scripts/setup.sh`は何度実行しても同じ状態にそろえます。mise本体やNodeが使えなくなっていれば入れ直し、`node_modules`は毎回`npm ci --ignore-scripts`で`package-lock.json`どおりに作り直します。`node_modules`を作り直すため、開発サーバーを止めてから実行してください。ダウンロードしたファイルが`mise.lock`のチェックサムと一致しないときは、修復せずに失敗します。

Node.js 24.22以上の24系、または26.12以上を自分で用意する場合は、`scripts/mise exec --`を省いて実行できます。npm lockfileを同梱しています。

`scripts/mise`は`mise generate install-script -V 2026.11.4 -l -w scripts/mise`で生成したものです。更新するときはバージョンを変えて再生成し、`scripts/mise lock`で`mise.lock`も更新します。

`npm run dev`で起動したら、http://127.0.0.1:5273 を開きます。初回起動でローカルD1へmigrationが適用されます。Cloudflare認証やアカウントは不要です。

## 操作

- タスクの追加、一覧、完了状態の設定、削除確認。
- 初回ロード失敗の再試行、操作失敗の表示、入力保持、連打防止。
- UI通信は10秒で打ち切り、書込みを自動再送しません。結果が不明なら再読込みで確認してください。
- キーボード操作・削除確認後のフォーカス復帰・reduced motionに対応。動きは短い操作フィードバックに限定。
- HTTP: GET/POST `/api/tasks`、PATCH/DELETE `/api/tasks/:id`。
- MCP: `http://127.0.0.1:5273/mcp`、標準Streamable HTTP。
- 旧 `/api/mcp` も互換用のエンドポイントとして`/mcp`と同じ処理を提供します。
- MCP tools: `list_tasks`、`create_task`、`set_task_completed`、`delete_task`。
- API/MCP/UIは同じスキーマとデータを利用。一覧は新しい順に最大100件。
- 完了はtoggleではなく状態設定。削除済みの再削除は成功応答で`deleted: false`。作成の再実行は別タスクを作ります。

## CLIから同じツールを呼ぶ

先に `npm run dev` を起動しておいてください。CLIは既定でローカル `/mcp` に接続し、サーバーのツールを直接呼びます。別のDBや操作の実装は持ちません。公開後は明示したHTTPSエンドポイントとトークンを使用できます。

```sh
npm run tasks -- list
npm run tasks -- call list_tasks '{}'
npm run tasks -- call create_task '{"title":"最初のサンプルを試す"}' --confirm
npm run tasks -- call set_task_completed '{"id":"取得したUUID","completed":true}' --confirm
npm run tasks -- call delete_task '{"id":"取得したUUID"}' --confirm
```

`list_tasks` 以外のツールを呼び出すには `--confirm` が必要です。これは意図的な呼出しを促すCLIのガードであり、認証や権限管理の代わりではありません。JSON結果を標準出力、エラーを標準エラーへ返し、失敗時は非ゼロ終了します。作成の結果が不明なときは一覧で確認し、盲目的に再実行しないでください。

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

## 構成

- `src/tasks/`: Zod contractsとDrizzle service
- `src/http/`: Hono API
- `src/mcp/`: 公式SDKのstateless Streamable HTTP
- `src/security/`: 認証境界、トークン管理と実バイト数による本文制限
- `src/client/`: 応答検証とUI操作状態
- `pages/`: React画面、Tailwindテーマ
- `db/`: D1 schemaとmigration
- `tests/`: 実Workers/D1統合テスト、ブラウザー操作テスト
- `.agents/`: pstack skillsとVoid skill

## 公開しないための境界

開発ビルドはloopbackからだけAPI/MCPを受け付けます。本番では認証が既定で無効になっており、API/MCPへの要求を503で拒否します。認証を有効にしたあとはセッションまたは失効可能なBearerトークンが必要で、全操作をユーザー別に分離します。MCP OAuth discoveryは提供せず、手動設定したBearerヘッダーで接続します。異なるOriginやcross-site要求は拒否し、本文の上限8KiB・入力スキーマ・DB制約・パラメータ化SQLで検証します。

同じマシンのプロセスはローカルデータを操作できます。localhost制限は認証の代わりではありません。公開前には認証設定・レート制限・バックアップなど運用を確認してください。本番のログインと公開URLでの動作は未検証です。

リポジトリは [upamune/techbookfest21-sample](https://github.com/upamune/techbookfest21-sample) です。Cloudflareへの接続・デプロイは含みません。

検証結果と未実行項目は[検証記録](docs/VERIFICATION.md)を参照してください。
