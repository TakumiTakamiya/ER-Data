# 開発引継ぎ

最終更新: 2026-09-30

このファイルは次の作業者向けの入口です。画面仕様は [`docs/SCREEN_GUIDE.md`](docs/SCREEN_GUIDE.md)、構成・API・検証・デプロイは [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md)、DB全体は [`DATABASE.md`](DATABASE.md) を参照してください。

## 現在の状態

- 公開先: `https://er-data.takumitakamiya.workers.dev`
- Worker: `er-data`
- D1: `er-data-db`
- 最終デプロイVersion ID: `86889e59-e0c2-4dc1-84c4-12d1eb2ee33d`
- ブランチ: `main`（`origin/main`を追跡）
- 認証・管理者判定: Cloudflare Accessのみ。メールアドレスやユーザー情報はコード/D1に保存しない。
- ローカルと本番D1には `0008_add_equipment_management.sql` まで適用済み。

## 重要: Git作業ツリー

Google Sheets版からCloudflare Worker + D1版への移行以降の変更が、現状では広範囲に未コミットです。削除扱いの旧Google連携ファイルや、新規のWorker・migration・Svelteコンポーネントは意図した変更です。内容を確認せずに `git checkout`、`git reset --hard`、旧ファイルの復元をしないでください。

開始時の確認例:

```powershell
git -c safe.directory=C:/Users/tkrta/Documents/ChatGPT/ER_Data status --short --branch
npm install
npx wrangler d1 migrations apply er-data-db --local
npm run cf:dev
```

この環境ではリポジトリ所有者判定により、通常の`git status`が拒否されることがあります。上記のようにコマンド単位で`safe.directory`を指定してください。グローバルGit設定は変更しないでください。

## 直近の実装

- 冒険詳細を編集ワークスペース化。
- 上段左にエピソード進捗、上段右に特別アイテムとメモを配置。
- 下段左に武器・盾・防具、下段右にタリスマン・スキルセット・遺灰を配置。
- 同じ所持品を複数追加可能。APIでは同一IDの件数を`quantity`へ集約する。
- 特別アイテム「ランタン」を追加。DB上は通常の特別アイテム、UI上は未所持/所持の二択。
- 防具・スキル・防具セットの一覧/編集/削除画面を実装。
- タリスマンの登録・検索付き一覧・詳細・編集・削除画面を実装。
- キャラクター作成は名前・冒険・素性だけ入力し、初期値をWorker側でも強制。
- キャラクター詳細で能力値とリソースを直接編集可能。最大HP/FP/加護、聖杯瓶合計・回復量・振り分けを保存する。
- キャラクター詳細で武器・盾・防具・タリスマンの装備、重量・回避コスト、スキルセット・通常スキルを管理する。
- 武器ごとの補正後ダメージ表、武器強化、武器・盾統合検索、装備／通常スキルのホバー詳細を実装。
- 防具性能を頭・胴体・合計の表へ整理し、装備スキルと発動中セットスキルを表の下へ集約。
- 装備と冒険所持品の移動はD1バッチで処理し、必要能力値と各上限をWorkerでも検証する。

## 直近の検証結果

- `npm test`: 60件成功
- `npm run check`: Svelte diagnostics 0 errors / 0 warnings
- `npm run build`: 成功
- `npx wrangler deploy --dry-run`: 成功
- ローカルD1で、ランタン所持状態、冒険メモ、特別アイテム数量、同一武器2個の保存を確認済み。

## 次の作業で注意すること

- `src/App.svelte`は独自History APIルーターを含む大きなコンポーネント。新しい固定ルートは、動的ID判定より先に分岐する。
- 通常利用者画面から`/api/admin/*`を呼ばない。Cloudflare Accessで拒否されるため、必要な選択肢は一般APIから返す。
- D1の複数所持は行の重複ではなく`quantity`。画面の重複ID配列との変換は`worker/index.ts`の冒険詳細/保存処理にある。
- 削除APIを追加する際は、外部キー参照元をすべて調査し、D1 `batch()`で関連解除と削除をまとめる。
- 新規migrationは既存番号の後ろへ追加し、ローカルで検証してから`--remote`へ適用する。本番データをテスト用途で変更しない。
- `npm run dev`はフロントだけ。D1を含む確認は`npm run cf:dev`を使用する。

## 既知の未実装・改善候補

- 武器、盾、武器カテゴリ、盾カテゴリ、素性、スキルセット、遺灰には一覧・編集・削除画面がまだない。
- アプリ内認証、ユーザーテーブル、操作履歴はない。
- `App.svelte`のルーティングと管理フォームは、画面増加に伴い分割余地がある。
