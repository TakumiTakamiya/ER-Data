# 開発・API・デプロイガイド

## 技術構成

- Svelte 5 + TypeScript
- Vite 7
- Cloudflare Worker Static Assets
- Cloudflare D1（SQLite互換）
- Wrangler 4.140.0
- Vitest + jsdom

主要ファイル:

| パス | 役割 |
|---|---|
| `src/App.svelte` | SPAルーター、一般画面、管理追加フォーム。 |
| `src/app.css` | 全体テーマとレスポンシブレイアウト。 |
| `src/lib/types.ts` | フロント/Workerで共有する型。 |
| `src/lib/api.ts` | JSON APIクライアントと共通エラー。 |
| `worker/index.ts` | 全API、入力検証、D1読み書き。 |
| `migrations/` | D1スキーマ変更と初期データ。 |
| `wrangler.jsonc` | Worker、Assets、D1 binding、observability。 |
| `DATABASE.md` | ER構造と各テーブルの意味。 |

## ローカル開発

```powershell
npm install
npx wrangler d1 migrations apply er-data-db --local
npm run cf:dev
```

`cf:dev`は先に本番向けビルドを作り、ローカルWorkerとローカルD1を起動する。表示されたURLは通常`http://127.0.0.1:8787`だが、使用中なら別ポートになる。

フロントだけの見た目作業には`npm run dev`も使えるが、`/api/*`は動かない。

## API

### 一般API

| Method | Path | 役割 |
|---|---|---|
| GET/POST | `/api/adventures` | 冒険一覧/作成 |
| GET/PUT | `/api/adventures/:id` | 冒険詳細/基本情報更新 |
| PUT | `/api/adventures/:id/episodes/:episodeId` | 進捗更新。LOCKEDは行削除。 |
| PUT | `/api/adventures/:id/contents` | メモ、特別アイテム、6種所持品を一括保存 |
| GET | `/api/origins` | 素性と初期装備・スキル詳細 |
| GET/POST | `/api/characters` | キャラクター一覧/作成 |
| GET/PUT | `/api/characters/:id` | キャラクター詳細/更新 |

### 管理API

| Method | Path | 役割 |
|---|---|---|
| GET | `/api/admin/options` | 管理フォームの選択肢 |
| POST | `/api/admin/episodes` | エピソード追加 |
| POST | `/api/admin/special-items` | 特別なアイテム追加 |
| GET/POST | `/api/admin/armors` | 防具一覧/追加 |
| PUT/DELETE | `/api/admin/armors/:id` | 防具更新/削除 |
| GET/POST | `/api/admin/armor-sets` | 防具セット一覧/追加 |
| DELETE | `/api/admin/armor-sets/:id` | 防具セット削除 |
| GET/POST | `/api/admin/skills` | スキル一覧/追加 |
| PUT/DELETE | `/api/admin/skills/:id` | スキル更新/削除 |
| GET/POST | `/api/admin/talismans` | タリスマン一覧/追加 |
| PUT/DELETE | `/api/admin/talismans/:id` | タリスマン更新/削除 |
| POST | `/api/admin/origins` | 素性追加 |
| POST | `/api/admin/weapons` | 武器追加 |
| POST | `/api/admin/weapon-categories` | 武器カテゴリ追加 |
| POST | `/api/admin/shields` | 盾追加 |
| POST | `/api/admin/shield-categories` | 盾カテゴリ追加 |
| POST | `/api/admin/skill-sets` | スキルセット追加 |
| POST | `/api/admin/spirit-ashes` | 遺灰追加 |

成功レスポンスはJSON。エラーは次の形式。

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

主なHTTP statusは400（入力不正）、404（未存在）、409（重複）、500（予期しない障害）。

## D1の重要な表現

- 固定8能力値は列形式。
- 多対多は中間テーブル。
- 冒険所持品は`adventure_*`テーブルの`quantity`。
- フロントでは重複ID配列として扱い、WorkerでID別件数へ変換する。
- 特別アイテムは0件も扱う。ランタンだけUI上0/1。
- エピソード進捗は、行なし=未開放、`UNLOCKED`、`COMPLETED`。
- スキル最大使用回数の無制限は`NULL`。
- 武器/盾の強化値はキャラクター装備枠に属する。

新しいmigrationは既存ファイルを編集せず、連番のSQLを追加する。可能なら再実行しても安全なSQLにする。

```powershell
npx wrangler d1 migrations apply er-data-db --local
npx wrangler d1 migrations apply er-data-db --remote
```

`--remote`は本番データを変更する。対象DBとSQLを確認し、必要な場合だけ実行する。

## 検証

```powershell
npm test
npm run check
npm run build
npx wrangler deploy --dry-run
```

APIやD1更新を変更した場合は、`npm run cf:dev`を起動し、実際のHTTPリクエストで成功/失敗/保存後再取得を確認する。テストデータを作った場合は元データを保存して復元し、一時マスターを削除する。

管理されたファイルサンドボックス内では、`svelte-check`起動時にVite configへ関するアクセス拒否が先に表示されることがある。最終行のSvelte diagnosticsとプロセス終了コードを確認する。通常環境で再現するエラーとして即断しない。

## 本番デプロイ

```powershell
npx wrangler deploy --dry-run
npm run cf:deploy
```

現在の公開先は`https://er-data.takumitakamiya.workers.dev`。

本番デプロイ前に確認すること:

1. 必要なD1 migrationを`--remote`へ適用済みか。
2. `wrangler.jsonc`のD1 database IDとWorker名が意図した本番か。
3. Cloudflare Accessがホスト全体と管理パスを保護しているか。
4. ソースや設定にメールアドレス、Access token、秘密情報を追加していないか。
5. dry-run、テスト、型チェック、ビルドが成功しているか。

Accessポリシー:

- Workerホスト全体: 一般利用者を許可
- `/admin`、`/admin/*`、`/api/admin/*`: 管理者だけを許可
- メールOTPを利用

アプリ側は認証状態や管理者権限を検証しない。これは意図した構成であり、Access設定を外したまま公開してはいけない。

## 実装パターン

### 管理追加画面を増やす

1. `src/lib/router.ts`の`adminKinds`と正規表現へ追加。
2. `src/lib/router.test.ts`へ追加。
3. `App.svelte`の`adminLabels`、`adminSections`、`initialAdmin`、フォーム分岐へ追加。
4. `worker/index.ts`の`adminCreate`と管理POST正規表現へ追加。
5. 関連選択肢が必要なら`AdminOptions`と`options()`を更新。

### 一覧/編集/削除画面を増やす

`ArmorCatalog.svelte`または`SkillCatalog.svelte`を雛形にする。GET一覧、PUT、DELETEを追加し、管理メニューと`App.svelte`に固定ルートを追加する。削除前にすべてのFK参照元を`rg`で調査する。

### 一般画面へ管理マスターの選択肢を出す

一般画面から`/api/admin/options`を呼ばない。Accessのパス制限で一般ユーザーが使えなくなる。冒険詳細APIの`inventoryOptions`のように、必要最小限の選択肢を一般APIへ含める。
