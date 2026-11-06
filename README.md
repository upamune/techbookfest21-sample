# Void Task Lab

技術書の構成検証用に、一から組み直したローカル専用サンプルです。タスクCRUDは仮題材で、書籍の最終題材ではありません。

Void / React / Hono / Cloudflare D1 / 標準Drizzle / Tailwind CSS v4 / shadcn Base UI / 標準MCPを使用します。pstackのTypeScript best practices・no-commentsと、cccc・similarity-ts・Knipを導入しています。

## 起動

Node.js 24.22以上の24系、または26.12以上。npm lockfileを同梱しています。

```sh
npm ci --ignore-scripts
npm run dev
```

http://127.0.0.1:5273 を開きます。初回起動でローカルD1へmigrationが適用されます。Cloudflare認証やアカウントは不要です。

## 操作

- タスクの追加、一覧、完了状態の設定、削除確認。
- 初回ロード失敗の再試行、操作失敗の表示、入力保持、連打防止。
- UI通信は10秒で打ち切り、書込みを自動再送しません。結果が不明なら再読込みで確認してください。
- キーボード操作・削除確認後のフォーカス復帰・reduced motionに対応。動きは短い操作フィードバックに限定。
- HTTP: GET/POST `/api/tasks`、PATCH/DELETE `/api/tasks/:id`。
- MCP: `http://127.0.0.1:5273/mcp`、標準Streamable HTTP。
- 旧 `/api/mcp` も互換入口として同じ処理を提供します。
- MCP tools: `list_tasks`、`create_task`、`set_task_completed`、`delete_task`。
- API/MCP/UIは同じスキーマとデータを利用。一覧は新しい順に最大100件。
- 完了はtoggleではなく状態設定。削除済みの再削除は成功応答で`deleted: false`。作成の再実行は別タスクを作ります。

## CLIから同じツールを呼ぶ

先に `npm run dev` を起動しておきます。CLIは固定のローカル `/mcp` に接続し、サーバーのツールを直接呼びます。別のDBや操作実装は持ちません。

```sh
npm run tasks -- list
npm run tasks -- call list_tasks '{}'
npm run tasks -- call create_task '{"title":"最初のサンプルを試す"}' --confirm
npm run tasks -- call set_task_completed '{"id":"取得したUUID","completed":true}' --confirm
npm run tasks -- call delete_task '{"id":"取得したUUID"}' --confirm
```

`list_tasks` 以外の呼出しは `--confirm` が必要です。これは意図的な呼出しを促すCLIのガードであり、認証や権限管理の代わりではありません。JSON結果を標準出力、エラーを標準エラーへ返し、失敗時は非ゼロ終了します。作成の結果が不明なときは一覧で確認し、盲目的に再実行しないでください。

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
- `src/security/`: local-only制約と実バイト数による本文制限
- `src/client/`: 応答検証とUI操作状態
- `pages/`: React画面、Tailwindテーマ
- `db/`: D1 schemaとmigration
- `tests/`: 実Workers/D1統合テスト、ブラウザー操作テスト
- `.agents/`: pstack skillsとVoid skill

## 公開しないための境界

認証・ユーザー別認可・MCP OAuthは未実装です。開発ビルドかつloopbackからだけAPI/MCPを受け付け、本番ビルドは503で拒否します。異なるOriginやcross-site要求は拒否し、本文上限8KiB・入力スキーマ・DB制約・パラメータ化SQLで検証します。

同じマシンのプロセスは操作できます。localhost制限は認証の代わりではありません。公開前には認証、所有者スコープ、CSRF/MCP認可、レート制限、運用を別途実装してください。

リポジトリは [upamune/techbookfest21-sample](https://github.com/upamune/techbookfest21-sample) です。Cloudflareへの接続・デプロイは含みません。

検証結果と未実行項目は[検証記録](docs/VERIFICATION.md)を参照してください。
