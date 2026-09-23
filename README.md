# 褪せ人の記録庫

Google スプレッドシートをデータストアとして使う、ELDEN RING TRPGキャラクター保管・閲覧アプリの概念実証です。Svelte 5 + TypeScript + Viteで構成され、GitHub Pagesだけで動作します。

## できること

- GoogleアカウントでSheets APIの利用を認可
- 共有スプレッドシートからキャラクターと素性を一括取得
- `classId`を使った外部キー参照
- キャラクターの作成・更新
- シートに保存しない派生値「ガード」の計算
- 401、403、シート構成不正、参照先欠落の表示

アクセストークンはブラウザのメモリにだけ保持します。ページを閉じたり再読み込みしたりすると、Googleへの再接続が必要です。

## 1. スプレッドシートを作る

1. Google スプレッドシートを新規作成します。
2. `Characters`と`Classes`という名前の2シートを作ります。名前は大文字・小文字を含め完全一致が必要です。
3. [sample-data/Characters.csv](sample-data/Characters.csv) と [sample-data/Classes.csv](sample-data/Classes.csv) の内容を、それぞれA1セルから貼り付けます。
4. アプリを使うGoogleアカウントを、スプレッドシートの「編集者」として共有します。
5. URLの `/spreadsheets/d/` と `/edit` の間にあるSpreadsheet IDを控えます。

列名はアプリとAPIの契約です。並び順は変更できますが、名前の変更や削除はできません。行の追加は可能です。`id`はシート内で一意にしてください。

## 2. Google Cloudを設定する

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成します。
2. 「APIとサービス」から **Google Sheets API** を有効にします。
3. OAuth同意画面を構成します。概念実証では公開ステータスを「テスト」にし、卓メンバーをテストユーザーとして追加します。
4. OAuthクライアントIDを「ウェブ アプリケーション」として作成します。
5. 「承認済みの JavaScript 生成元」に開発用の `http://localhost:5173` と、公開先の `https://<user>.github.io` を追加します。生成元にはパスを含めません。
6. 発行されたクライアントIDを控えます。クライアントシークレットはこのアプリでは使用しません。

このアプリは `https://www.googleapis.com/auth/spreadsheets` スコープを要求します。テストユーザー以外へ一般公開する場合は、GoogleのOAuth審査やプライバシーポリシーが必要になる可能性があります。

## 3. ローカルで動かす

Node.js 22以降を推奨します。

```sh
npm install
Copy-Item .env.example .env.local
```

`.env.local`を編集します。

```dotenv
VITE_GOOGLE_CLIENT_ID=発行されたクライアントID
VITE_GOOGLE_SPREADSHEET_ID=共有スプレッドシートID
```

```sh
npm run dev
```

ブラウザで `http://localhost:5173` を開き、「Googleに接続」を押します。

## 4. GitHub Pagesへ公開する

1. GitHubリポジトリの **Settings → Pages → Build and deployment** で Source を **GitHub Actions** にします。
2. **Settings → Secrets and variables → Actions → Variables** に次のRepository variablesを作ります。
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_SPREADSHEET_ID`
3. デフォルトブランチを`main`にし、pushします。
4. `Deploy to GitHub Pages`ワークフローがテスト、型チェック、ビルド、デプロイを行います。

クライアントIDとSpreadsheet IDはブラウザに配布される識別子であり、秘密鍵ではありません。アクセストークンやクライアントシークレットはGitHubへ登録しないでください。

## 開発コマンド

```sh
npm run dev       # 開発サーバー
npm test          # 単体テスト
npm run check     # Svelte/TypeScriptチェック
npm run build     # 本番ビルド
npm run preview   # 本番ビルドのローカル確認
```

## データ仕様

### Characters

| 列 | 内容 |
|---|---|
| `id` | UUID。シート内で一意 |
| `name` | キャラクター名 |
| `level` | 1以上の整数 |
| `classId` | `Classes.id`への参照 |
| `vigor` | 生命力。1以上の整数 |
| `mind` | 精神力。1以上の整数 |
| `endurance` | 持久力。1以上の整数 |
| `notes` | 備考 |
| `updatedAt` | アプリが保存するISO日時 |

### Classes

| 列 | 内容 |
|---|---|
| `id` | 素性ID。シート内で一意 |
| `name` | 表示名 |
| `guardBonus` | 0以上の整数 |
| `description` | 説明 |

ガードは `floor(endurance / 4) + guardBonus` でフロントエンド内だけで計算されます。

## 概念実証としての制約

- 同時更新の競合検出はなく、最後に保存した内容が優先されます。
- 削除、履歴、オフライン対応はありません。
- スプレッドシートを直接編集するときも列名・ID・数値制約を守る必要があります。
- 書き込みスコープは、そのユーザーがアクセス可能なスプレッドシート全体を対象にします。本番化ではGoogle Pickerと`drive.file`スコープ、またはApps Script等の専用APIも比較検討してください。
