# 褪せ人の記録庫

ELDEN RING TRPGのキャラクターとマスターデータを共有管理する、Svelte 5 + Cloudflare Workers + D1アプリです。

## 機能

- キャラクターの一覧、作成、詳細、編集
- 冒険の一覧、作成、編集
- 素性、防具、防具セット、武器、武器カテゴリ、盾、盾カテゴリ、スキル、スキルセット、遺灰の登録
- 関連マスターが存在しない場合の同時登録
- 素性初期値・成長値・追加値からの現在能力値計算

認証と管理者判定はアプリ内に実装せず、Cloudflare Accessのパス別ポリシーで行います。

## 構成

```text
ブラウザ（Svelte SPA）
        │ /api/*
Cloudflare Worker
        │ DB binding
Cloudflare D1: er-data-db
```

- `src/`：Svelteフロントエンドと共有API型
- `worker/index.ts`：Worker API
- `migrations/`：D1スキーマと初期データ
- `wrangler.jsonc`：Static Assets、Worker、D1の設定
- `DATABASE.md`：テーブル構造と運用上の役割
- `DIALY.md`：次の作業者向けの現状と注意事項
- `docs/SCREEN_GUIDE.md`：画面・ルーティング・UI仕様
- `docs/DEVELOPMENT_GUIDE.md`：API、ローカル開発、検証、デプロイ

## ローカル開発

Node.js 22以降を推奨します。

```powershell
npm install
npx wrangler d1 migrations apply er-data-db --local
npm run cf:dev
```

`npm run dev`はフロントエンドだけを起動するため、D1 APIを利用する通常の動作確認には`npm run cf:dev`を使用してください。

## 検証

```powershell
npm test
npm run check
npm run build
npx wrangler deploy --dry-run
```

## Cloudflare Access

本番デプロイ前に、WorkerのホストへCloudflare Accessを設定します。

1. メールOTPを有効化する。
2. Workerホスト全体を卓メンバーのAllowポリシーで保護する。
3. `/admin`、`/admin/*`、`/api/admin/*`を管理者だけのAllowポリシーで保護する。
4. 未認証者、一般利用者、管理者それぞれでアクセスを確認する。
5. 確認後に`npm run cf:deploy`を実行する。

メールアドレスはCloudflare Dashboardで登録し、リポジトリやD1には保存しません。Accessが未設定の状態では、書き込みAPIを含むバージョンを本番へデプロイしないでください。

## API

一般API：

- `GET/POST /api/adventures`
- `GET/PUT /api/adventures/:id`
- `PUT /api/adventures/:id/episodes/:episodeId`
- `PUT /api/adventures/:id/contents`
- `GET /api/origins`
- `GET/POST /api/characters`
- `GET/PUT /api/characters/:id`
- `POST/DELETE /api/characters/:id/weapons[/:slotId]`
- `POST/DELETE /api/characters/:id/shields[/:slotId]`
- `PUT/DELETE /api/characters/:id/armors/:slot`
- `POST/DELETE /api/characters/:id/talismans[/:slotId]`
- `POST /api/characters/:id/skill-sets`
- `POST/PUT/DELETE /api/characters/:id/skills[/:rowId]`

管理API：

- `GET /api/admin/options`
- `POST /api/admin/episodes`
- `POST /api/admin/special-items`
- `GET /api/admin/armor-sets`
- `DELETE /api/admin/armor-sets/:id`
- `GET /api/admin/armors`
- `PUT/DELETE /api/admin/armors/:id`
- `GET /api/admin/skills`
- `PUT/DELETE /api/admin/skills/:id`
- `GET/POST /api/admin/talismans`
- `PUT/DELETE /api/admin/talismans/:id`
- `POST /api/admin/origins`
- `POST /api/admin/armors`
- `POST /api/admin/armor-sets`
- `POST /api/admin/weapons`
- `POST /api/admin/weapon-categories`
- `POST /api/admin/shields`
- `POST /api/admin/shield-categories`
- `POST /api/admin/skills`
- `POST /api/admin/skill-sets`
- `POST /api/admin/spirit-ashes`

エラーは`{ "error": { "code": "...", "message": "..." } }`形式です。
