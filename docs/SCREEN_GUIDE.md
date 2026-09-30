# 画面仕様・ルーティング

## 共通

- Svelte 5のSPA。外部ルーターは使わず、`src/App.svelte`内で`history.pushState`と`popstate`を処理する。
- `/`は`/characters`へ置換される。
- ダークテーマとレスポンシブCSSは`src/app.css`に集約。
- 通信中、通信失敗、保存成功の表示は各画面または`App.svelte`で管理する。
- `/admin`、`/admin/*`、`/api/admin/*`はCloudflare Accessで管理者だけに許可する前提。

## キャラクター

| URL | 画面 | 主な仕様 |
|---|---|---|
| `/characters` | 一覧 | 名前、レベル、素性、冒険を表示。カードから詳細へ。 |
| `/characters/new` | 作成 | 入力は名前・冒険・素性だけ。選択中の素性の初期情報を表形式で表示。 |
| `/characters/:id` | 詳細 | レベル、ルーン、素材点、8能力値を表示。 |
| `/characters/:id/edit` | 編集 | 基本情報、レベル、所持値、成長値、追加値を編集。 |

作成時はWorkerが、レベルを素性の初期レベル、ルーン・素材点・全成長値・全追加値を0へ強制する。フロントの値だけを信用しない。

素性プレビューでは初期武器・盾・頭胴防具・スキルセットを表示する。スキル名を押すと詳細ダイアログを開き、空のランク効果は表示しない。

## 冒険

| URL | 画面 | 主な仕様 |
|---|---|---|
| `/adventures` | 一覧 | カードから`/adventures/:id`へ遷移。 |
| `/adventures/new` | 作成 | 名前とメモで作成。 |
| `/adventures/:id` | 編集ワークスペース | 進捗・特別アイテム・メモ・所持品を編集。 |
| `/adventures/:id/edit` | 互換URL | `/adventures/:id`へ置換。独立した編集画面はない。 |

編集ワークスペースは次の配置。

```text
┌──────────────────────┬──────────────────────┐
│ エピソード進捗       │ 特別なアイテム       │
│                      │ メモ                 │
├──────────────────────┼──────────────────────┤
│ 武器・盾・防具       │ タリスマン           │
│                      │ スキルセット・遺灰   │
└──────────────────────┴──────────────────────┘
```

- エピソード進捗は未開放/開放済み/達成済み。変更時に即時保存。
- 特別アイテム、メモ、所持品はヘッダーの「変更を保存」で一括保存。
- ランタンだけは数量入力ではなく未所持/所持。DB上の数量は0/1。
- 所持品は`SkillTransfer.svelte`の重複許可モード。重複回数を所持数として保存する。
- 選択肢が存在しない種類は空の選択欄になる。

主要実装: `src/lib/AdventureWorkspace.svelte`。

## 管理メニュー

`/admin/`を次のセクションに分けている。

- 冒険: エピソード追加、特別なアイテム追加
- 素性: 素性追加
- 防具: 防具追加、防具一覧、防具セット追加、防具セット一覧
- 装備（武器・盾・タリスマン）: 武器追加、武器カテゴリ追加、盾追加、盾カテゴリ追加、タリスマン追加、タリスマン一覧
- スキル関連: スキル追加、スキル一覧、スキルセット追加
- 遺灰: 遺灰追加

### 管理追加画面

| URL | 内容 |
|---|---|
| `/admin/episodes/new` | メイン/外伝、EP番号、名前、悪意適正レベル。表示コードはWorkerで生成。 |
| `/admin/special-items/new` | 特別なアイテム名。 |
| `/admin/origins/new` | 初期レベル、8能力、初期装備、初期スキルセット。初期武器は重複可。 |
| `/admin/armors/new` | 防具、部位、性能、防具セット、装備スキル。 |
| `/admin/armor-sets/new` | 名前、シリーズ効果、装備スキル。 |
| `/admin/weapons/new` | 武器カテゴリ、性能、必要能力値、装備スキル。 |
| `/admin/weapon-categories/new` | サイズ、コスト、ダメージ表、ガード性能、装備スキル。 |
| `/admin/shields/new` | 盾カテゴリ、性能、必要能力値、装備スキル。 |
| `/admin/shield-categories/new` | 名前、サイズ。 |
| `/admin/talismans/new` | 名前、効果。 |
| `/admin/skills/new` | 基本情報、3ランク効果、武器/盾カテゴリ。入力補助あり。 |
| `/admin/skill-sets/new` | 名前、注意点、スキル選択。 |
| `/admin/spirit-ashes/new` | 基本性能、メイン/サブアクション、5段階強化効果。 |

### 管理一覧画面

| URL | 実装 | 機能 |
|---|---|---|
| `/admin/armors` | `ArmorCatalog.svelte` | 検索、詳細、編集、削除。 |
| `/admin/armor-sets` | `App.svelte` | 一覧、件数表示、削除。 |
| `/admin/skills` | `SkillCatalog.svelte` | 検索、詳細、編集、削除。 |
| `/admin/talismans` | `TalismanCatalog.svelte` | 名前・効果の検索、詳細、編集、削除。 |

防具削除は素性初期防具・キャラクター装備・冒険所持品・装備スキル関連を解除する。スキル削除はスキルセット、各装備、カテゴリ、キャラクター装備との関連を解除する。タリスマン削除は冒険所持品・キャラクター装備との関連を解除する。防具セット削除時は、防具のセット参照が`ON DELETE SET NULL`、セットスキルがcascadeされる。

## 共通UIコンポーネント

- `SkillTransfer.svelte`: 左の検索付き候補、中央の追加/解除、右の選択済み一覧。`allowDuplicates`で複数所持に対応。
- `SingleEquipPicker.svelte`: 頭/胴など単一装備の選択と解除。
- `GuardCutInput.svelte`: `□*☆*`形式の入力補助。
- `AdventureWorkspace.svelte`: 冒険編集。
- `ArmorCatalog.svelte`: 防具一覧/編集/削除。
- `SkillCatalog.svelte`: スキル一覧/編集/削除。
- `TalismanCatalog.svelte`: タリスマン一覧/編集/削除。
