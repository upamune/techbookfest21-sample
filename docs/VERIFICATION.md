# 検証結果

## 2026-11-08 モノレポ化（Forum / Things）

- タスクCRUDを削除し、npm workspacesで`apps/forum`、`apps/things`、`packages/tools`、`packages/ui`へ分割した。
- macOS arm64・Node 24.22.1で`npm ci --ignore-scripts`、`npm run check`、`npm run typecheck`、`npm test`、`npm run quality`、`npm run build`、`npm run test:e2e`（API・CLI・ブラウザ計26件）が成功。
- ブラウザテストは390×844のタッチ端末設定のChromiumで実行した。実機のiOS Safari・Androidと、ソフトウェアキーボード表示中の挙動は未確認。
- R2への写真保存と所有者分離はMiniflareで確認した。CloudflareのR2・D1への配備は未実施。
- `tasks`テーブルを消すmigrationには`-- void:allow-destructive`を付けた。適用時のローカルの`tasks`は0行だった。

## 2026-11-08 miseによるNode固定

- `scripts/mise`をmise 2026.11.4の`generate install-script --localize`で生成。手元の2026.3.9の`generate bootstrap -V 2026.11.4`はpanicしたため、公式リリースのSHASUMS256.txtで検証した2026.11.4で生成した。
- macOS arm64で、未導入状態の`.mise/`へmise本体をチェックサム検証して取得できた。
- `mise.lock`のNode 24.22.1のチェックサムは、nodejs.orgのSHASUMS256.txtと一致した（darwin/linux/win）。
- `scripts/mise install --locked`、`npm ci --ignore-scripts`、`npm run check`、Knip、`npm run dev`の起動とAPI応答が成功。
- `scripts/setup.sh`をリポジトリ外のカレントディレクトリから実行し、次の状態から全て終了コード0で復旧した: `.mise`と`node_modules`なし、2回目の実行、mise本体の破損・欠落、`node`バイナリの欠落、同梱npmの欠落、Nodeインストール全体の欠落、`node_modules`の一部欠落。
- `mise.lock`のNodeチェックサムを書き換えると、`scripts/setup.sh`は入れ直しを試みた後に終了コード1で止まった。元に戻すと再実行で復旧した。Linuxでの`scripts/setup.sh`は未実行。
- 同日、macOS arm64・Node 24.22.1でブラウザ8件を含む`npm run test:e2e`の13件がローカルで成功した。Linux executorのChromium制限はこの環境では発生しなかった。

## 2026-11-07 認証付き公開準備

- check / typecheck / unit 123件 / build / Knip / cccc / similarity-ts 成功。
- 実Miniflare/D1に全migrationを適用し、所有者間の一覧・変更・削除分離と、token失効・期限切れ・アカウント削除・有効100件上限を確認。
- ローカル実Workers/D1/API/MCP/CLIの統合テスト5件成功。
- ブラウザ8件は、このexecutorのChromiumが `socket() failed: Operation not permitted` で起動不可。成功扱いにせずGitHub CIで確認する。
- Playwrightのpreviewは既存 `.env` のない専用checkoutで実行する。テスト用認証secretを一時生成し、終了時に消去する。実アカウントや本番credentialsは使用しない。
- GitHub・Google OAuthの実ログイン、Cloudflare資源作成、本番公開URLは未実施。以前のlocal-only記録は以下に履歴として残す。

## 以前の検証

2026-11-06 に Node.js 24.22.1 / npm 11.9.0 / Linux x64 で確認。

## UI・通信回復の追加検証

- 中立色のタスク作業画面へ整理。長い題名・320px幅・文字拡大・reduced motionを想定したブラウザー回帰試験を追加。
- 10秒の通信期限を呼出し元のキャンセルと合成し、応答本文の読み込みも期限対象とする。書込みは自動再試行しない。
- 削除確認はキャンセルへ初期フォーカスし、キャンセル後は元ボタン、削除後は入力へ戻す。入力フォーカス表示と簡潔な読み上げ通知を追加。
- 単体テスト67件、型付きlint・型検査・品質ゲート・ビルド・実Workers/D1統合テスト5件が通過。最終ブラウザー操作検証は別途結果を記録する。
- ソースレビューで不要コメント・正しさを抑制する指示は検出なし。

## CLI・標準入口の追加検証

- `/mcp` を標準入口に追加し、旧 `/api/mcp` の互換性を維持。
- CLIは共有Zod入力と標準MCPクライアントを使用。変更系の明示確認、固定loopback、redirect拒否、10秒deadline、自動再送なし。
- 単体テストは5ファイル61件が通過。型付きlint、strict型検査、build、Knip/cccc/similarityも通過。
- ccccは19ファイル91関数、最大cognitive 7 / cyclomatic 10。similarityは15ファイルで設定閾値以上の重複なし。
- 実Workers/D1統合テスト5件が通過。標準入口と互換入口、CLIとHTTPの同一データ、変更確認、MCPエラーの非ゼロ終了を確認。
- この変更のブラウザテストはローカルでは再実行していません。初期コミットのCI成功と混同しないでください。

## 初期実装の通過項目

- `npm run check`: フォーマット、型付き lint が通過。
- `npm run typecheck`: strict TypeScript が通過。
- `npm test`: 4 ファイル、38 テストが通過。
- `npm run build`: クライアント・SSR・Cloudflare Worker のビルドが通過。
- `npm run quality`: Knip 6.44.1、cccc 1.8.6、similarity-ts 0.5.0 が通過。
- Knip の未使用コード・依存検出は 0 件。
- cccc は 16 ファイル・88 関数を解析。関数単位の最大 cognitive は 7、cyclomatic は 10。閾値は 15 / 10。
- similarity-ts は 12 ファイルを検査。類似度 0.90、最小 8 行の設定で重複関数・類似型は 0 件。
- 実際のローカル Workers/D1 を使う API 統合テストは 3 件通過。HTTP と MCP の共有永続化、更新・削除の冪等性、入力・Origin・本番拒否、SSR を確認。
- ソースレビューで通常のコードコメント・抑制指示は 0 件。必要な Vite コンパイラ用 triple-slash directive は保持。

## 初期コミットのGitHub Actions検証

初期コミット `def87ea3d074bb2e2e2aaa61f635be07e4752152` は [Check #1](https://github.com/upamune/techbookfest21-sample/actions/runs/42185113553) の `npm run ci` が成功しています。ブラウザテストを含むCIの結果です。以下は初回ローカル実行時の制限の記録であり、以後の変更まで検証したという意味ではありません。

## 初回ローカルのブラウザ検証制限

Playwright のブラウザテスト 4 件は用意済みですが、この実行環境では Chromium が `socket() failed: Operation not permitted` で起動できず、画面操作の検証は実行できませんでした。テスト失敗をアプリの成功として扱っていません。実ブラウザでの表示、作成・再読み込み・完了・削除、通信失敗時の再試行は、ブラウザを実行できる環境で確認してください。

```sh
npm ci --ignore-scripts
npm run tools:setup
npx playwright install --with-deps chromium
npm run ci
```

GitHub Actions の設定は `.github/workflows/check.yml` にあります。初回ローカル検証後にリポジトリへpushされ、上記のCIが成功しています。

この制限環境で API テストを実行する際は、書込み可能な設定ディレクトリと Inspector 無効化を指定しました。

```sh
npm run build
XDG_CONFIG_HOME=/tmp/void-v2-config VOID_INSPECTOR_PORT=false npm run test:integration
```

プレビューがビルド出力を移動するため、E2E を再実行するときは先にビルドし直してください。Cloudflare の Request.cf 取得失敗時はランタイム既定値にフォールバックしました。このアプリは Request.cf を使用しません。

## 依存監査

- `npm audit --omit=dev`: 0 件。
- 開発依存を含む `npm audit`: low 2 件、moderate 10 件、high/critical 0 件。
- 対象は Void / Drizzle Kit / shadcn 系の推移依存（esbuild、minimatch、deepmerge などを含む）。開発ツール側の更新追跡が必要です。破壊的な `audit fix --force` は適用していません。

## 提供範囲

ローカル学習用サンプルです。認証・認可は未実装であり、本番では HTTP API と MCP を閉じる設計です。本番向けデプロイは行っていません。ローカル学習用の境界を維持しています。
