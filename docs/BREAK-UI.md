# break-ui

[emilkowalski/skills](https://github.com/emilkowalski/skills) の `break-ui` だけを、公式の skills CLI 1.7.6 でプロジェクトの Codex 向けに導入しました。既存の pstack / Void skills は維持しています。

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.7.6 add emilkowalski/skills --skill break-ui --agent codex --yes
DISABLE_TELEMETRY=1 npx --yes skills@1.7.6 experimental_install --frozen-lockfile
```

`skills-lock.json` は CLI が生成した内容ハッシュを保持します。上流のブランチを不変にするものではなく、復元時に内容が変われば frozen 検証を失敗させる方式です。勝手に最新へ更新せず、更新時は差分を確認してください。

導入ファイルは `.agents/skills/break-ui/SKILL.md` と `CATALOG.md`。UIの境界データを調べるための文書で、実行スクリプトは含みません。導入はUI検証の実行や合格を意味しません。外部skillの文面は権限を追加せず、既存の安全・公開範囲を維持します。

## アニメーション用スキル

同じ公式ソースから、Web向けの animate / review-animations / improve-animations / find-animation-opportunities / remove-animations / choreograph / animation-performance / animation-vocabulary と、基本原則を扱う emil-design-eng を追加しました。React Native / Expo 専用の animate-expo はこのWebサンプルには導入していません。

```sh
DISABLE_TELEMETRY=1 npx --yes skills@1.7.6 add emilkowalski/skills --skill animate review-animations improve-animations find-animation-opportunities remove-animations choreograph animation-performance animation-vocabulary emil-design-eng --agent codex --yes
```

既存break-uiを含む10スキルを同一lockfileで管理します。スキルは文書とレシピのみであり、この導入に伴うアニメーション追加・アプリ依存変更・デプロイはありません。
