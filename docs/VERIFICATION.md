# 検証結果

2026-11-06 に Node.js 24.22.1 / npm 11.9.0 / Linux x64 で確認。

## 通過

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

## ブラウザ検証は未完了

Playwright のブラウザテスト 4 件は用意済みですが、この実行環境では Chromium が `socket() failed: Operation not permitted` で起動できず、画面操作の検証は実行できませんでした。テスト失敗をアプリの成功として扱っていません。実ブラウザでの表示、作成・再読み込み・完了・削除、通信失敗時の再試行は、ブラウザを実行できる環境で確認してください。

```sh
npm ci --ignore-scripts
npm run tools:setup
npx playwright install --with-deps chromium
npm run ci
```

GitHub Actions の設定は `.github/workflows/check.yml` にあります。外部リポジトリへの push や Actions 実行はしていません。

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

ローカル学習用サンプルです。認証・認可は未実装であり、本番では HTTP API と MCP を閉じる設計です。本番向けデプロイ、外部リポジトリの新設・変更、クラウド環境の新設は行っていません。
