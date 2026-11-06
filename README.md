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
- HTTP: GET/POST `/api/tasks`、PATCH/DELETE `/api/tasks/:id`。
- MCP: `http://127.0.0.1:5273/api/mcp`、標準Streamable HTTP。
- MCP tools: `list_tasks`、`create_task`、`set_task_completed`、`delete_task`。
- API/MCP/UIは同じスキーマとデータを利用。一覧は新しい順に最大100件。
- 完了はtoggleではなく状態設定。削除済みの再削除は成功応答で`deleted: false`。作成の再実行は別タスクを作ります。

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

GitHubリポジトリ作成・push・Cloudflare接続・デプロイは行っていません。正式なCodexクラウド環境を作成する場合は、このリポジトリの公開先と環境設定が別途必要です。

検証結果と未実行項目は[検証記録](docs/VERIFICATION.md)を参照してください。
