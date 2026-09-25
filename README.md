# 褪せ人の記録庫

Google スプレッドシートをデータストアとして使う、ELDEN RING TRPGキャラクター保管・閲覧アプリの概念実証です。Svelte 5 + TypeScript + Viteで構成され、GitHub Pagesだけで動作します。

## できること

- Googleアカウントで選択した1ファイルだけの利用を認可
- Google Pickerで、この記録庫用のスプレッドシートを明示的に選択
- 共有スプレッドシートからキャラクターと素性を一括取得
- `classId`を使った外部キー参照
- キャラクターの作成・更新
- シートに保存しない派生値「ガード」の計算
- 401、403、シート構成不正、参照先欠落の表示

OAuthスコープには、ファイル単位でアクセスを許可する非機密スコープ `https://www.googleapis.com/auth/drive.file` を使用します。アクセストークンはブラウザのメモリにだけ保持します。ページを閉じたり再読み込みしたりすると、Googleへの再接続とファイル選択が必要です。

## 1. スプレッドシートを作る

1. Google スプレッドシートを新規作成します。
2. `Characters`と`Classes`という名前の2シートを作ります。名前は大文字・小文字を含め完全一致が必要です。
3. [sample-data/Characters.csv](sample-data/Characters.csv) と [sample-data/Classes.csv](sample-data/Classes.csv) の内容を、それぞれA1セルから貼り付けます。
4. アプリを使うGoogleアカウントを、スプレッドシートの「編集者」として共有します。
5. URLの `/spreadsheets/d/` と `/edit` の間にあるSpreadsheet IDを控えます。

列名はアプリとAPIの契約です。並び順は変更できますが、名前の変更や削除はできません。行の追加は可能です。`id`はシート内で一意にしてください。

## 2. Google Cloudを設定する

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成します。
2. 「APIとサービス」→「ライブラリ」から **Google Sheets API** と **Google Picker API** を有効にします。
3. プロジェクトの「ダッシュボード」または「プロジェクト情報」に表示される数字だけの **プロジェクト番号**を控えます。これがGoogle PickerのApp IDです。
4. OAuth同意画面を構成します。概念実証では公開ステータスを「テスト」にし、卓メンバーをテストユーザーとして追加します。
5. OAuthクライアントIDを「ウェブ アプリケーション」として作成します。
6. 「承認済みの JavaScript 生成元」に開発用の `http://localhost:5173` と、公開先の `https://<user>.github.io` を追加します。生成元にはパスを含めません。
7. 発行されたクライアントIDを控えます。クライアントシークレットはこのアプリでは使用しません。
8. 「認証情報」→「認証情報を作成」→「APIキー」で、Google Picker用のAPIキーを作成します。
9. APIキーの「アプリケーションの制限」を **ウェブサイト** にし、`http://localhost:5173/*` と `https://<user>.github.io/*` を許可します。
10. APIキーの「APIの制限」を **キーを制限** にし、**Google Picker API**だけを選択します。

このアプリは `drive.file` スコープでGoogle Pickerに表示されたファイルをユーザー自身に選ばせます。選択されたIDが設定済みのSpreadsheet IDと一致した場合だけ、Sheets APIを呼び出します。別のファイルを選択すると接続を拒否します。

### 以前の全スプレッドシート権限を解除する

旧バージョンを一度でも認可したアカウントは、広い `spreadsheets` スコープの許可がGoogleアカウント側に残っている可能性があります。[Googleアカウントのサードパーティ接続](https://myaccount.google.com/connections)を開き、このアプリへの既存アクセスを一度削除してから、新しいバージョンで再接続してください。

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
VITE_GOOGLE_API_KEY=Google Picker用APIキー
VITE_GOOGLE_APP_ID=数字だけのGoogle Cloudプロジェクト番号
```

```sh
npm run dev
```

ブラウザで `http://localhost:5173` を開き、「Googleに接続」を押します。認可後にGoogle Pickerが開くので、手順1で作成した共有スプレッドシートを選択します。

## 4. GitHub Pagesへ公開する

1. GitHubリポジトリの **Settings → Pages → Build and deployment** で Source を **GitHub Actions** にします。
2. **Settings → Secrets and variables → Actions → Variables** に次のRepository variablesを作ります。
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_SPREADSHEET_ID`
   - `GOOGLE_API_KEY`
   - `GOOGLE_APP_ID`
3. デフォルトブランチを`main`にし、pushします。
4. `Deploy to GitHub Pages`ワークフローがテスト、型チェック、ビルド、デプロイを行います。

4つの値はすべてブラウザへ配布されます。APIキーは必ずHTTPリファラーとGoogle Picker APIで制限してください。アクセストークンやクライアントシークレットはGitHubへ登録しないでください。

## Cloudflare Workersで静的サイトを確認する

将来のD1移行に備え、同じSvelteアプリをCloudflare Workers Static Assetsでも配信できます。現時点では静的ホスティングだけを使用し、D1・認証API・データ移行はまだ構成しません。

現在の確認用URL: <https://er-data.takumitakamiya.workers.dev>

```sh
npx wrangler login
npm run cf:deploy
```

ローカルでCloudflare配信構成を確認する場合は次を使います。

```sh
npm run cf:dev
```

Google Sheets版として動かす間は、通常のViteビルドと同じ4つの`VITE_GOOGLE_*`環境変数が必要です。Cloudflare版の動作確認後も、移行が完了するまではGitHub Pagesを停止しません。

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
- `drive.file`はユーザーがGoogle Pickerで選択したファイルをアプリから操作可能にします。セルやシート単位へさらに細かくOAuth権限を限定することはできません。
- Pickerで別ファイルを選んだ場合、その選択はGoogle側ではユーザーによる許可になりますが、本アプリは固定のSpreadsheet IDと一致しないファイルを読み書きしません。
