# ER Data データベース仕様

この文書は、ELDEN RING TRPG用アプリ「褪せ人の記録庫」で使用するCloudflare D1データベースの設定、データ構造、各テーブルの役割をまとめたものです。

正確なスキーマの一次情報は、次のマイグレーションファイルです。

- `migrations/0001_initial_schema.sql`
- `migrations/0002_seed_special_items.sql`

## 現在の状態

- Cloudflare D1への初期デプロイ：完了
- D1データベース名：`er-data-db`
- D1バインディング名：`DB`
- 配置ヒント：APAC
- Worker名：`er-data`
- Worker URL：<https://er-data.takumitakamiya.workers.dev>
- アプリ用テーブル数：42
- 明示的に作成したインデックス数：30
- 認証テーブル：未実装
- D1を操作するWorker API：実装・本番デプロイ済み
- フロントエンド：D1 API版

## Cloudflare設定

`wrangler.jsonc`には次のD1バインディングが設定されています。

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "er-data-db",
      "database_id": "3d1d4b21-6a4b-44f6-bc19-13e1764c2c17"
    }
  ]
}
```

Worker APIが`env.DB`を通じてD1へアクセスします。ブラウザからD1へ直接接続する構成ではありません。

```text
Svelteフロントエンド
        │ HTTP /api/*
        ▼
Cloudflare Worker
        │ env.DB
        ▼
Cloudflare D1: er-data-db
```

`database_id`はD1リソースの識別子であり、パスワードやAPIトークンではありません。Cloudflareの認証情報はリポジトリへ保存しません。

## データの分類

データは大きく次の4種類に分かれます。

1. マスターデータ
   - 武器、防具、スキル、エピソードなど、ゲームルールとして定義されるデータ
2. 素性初期データ
   - 素性ごとの初期能力値、初期装備、初期スキルセット
3. 冒険共有データ
   - 複数キャラクターが共有する所持品、特別アイテム、エピソード進捗
4. キャラクター状態
   - 能力成長値、追加値、現在の装備、習得済みスキルセット

## 主な関係

```text
adventures
├─ characters
│  ├─ character_weapon_slots
│  ├─ character_shield_slots
│  ├─ character_equipped_armors
│  ├─ character_equipped_talismans
│  ├─ character_learned_skill_sets
│  └─ character_equipped_skills
├─ adventure_weapons
├─ adventure_shields
├─ adventure_armors
├─ adventure_talismans
├─ adventure_skill_sets
├─ adventure_spirit_ashes
├─ adventure_special_items
└─ adventure_episode_progress
```

- キャラクターは必ず1つの冒険に所属します。
- 所持品はキャラクター個人ではなく、冒険全体で共有します。
- キャラクター側には現在の装備状態だけを保存します。
- マスターデータとプレイ中に変化するデータは分離します。

## マスターテーブル

### `origins`

素性を定義します。

主な列：

- `id`：内部ID
- `name`：素性名。一意
- `initial_level`：初期レベル
- `initial_vigor`～`initial_arcane`：8能力値の初期値

能力値はルール上8種類固定で、常にまとめて扱うため列形式です。

### `armor_sets`

防具セットを定義します。

- `name`：セット名。一意
- `series_effect`：シリーズ効果

### `armors`

頭防具と胴体防具を共通管理します。

- `armor_set_id`：所属する防具セット。所属しない場合はNULL
- `name`：防具名。一意
- `armor_slot`：`HEAD`または`BODY`
- `weight`：重量
- `physical_cut`：物理カット値
- `phenomenon_cut`：現象カット値
- `poise`：強靭値

### `weapon_categories`

武器カテゴリと、カテゴリ共通の攻撃・ガード性能を定義します。

- `name`、`size`
- `attack_cost`
- `one_hand_damage_1`～`one_hand_damage_5`
- `two_hand_damage_1`～`two_hand_damage_5`
- `guard_cost`
- 両手持ち時の物理／現象ガード値

片手持ちではガードできないため、片手用のガード値は保持しません。カテゴリ自体がガード不可の場合は、両手持ち時の物理／現象ガード値を空文字で保持します。片手・両手のダメージはそれぞれ1～5 hitの5列で保持します。

ダメージは計算式やゲーム上の表記をそのまま保持するため`TEXT`です。攻撃できない持ち方・hit数の列は空文字で保持します。

### `weapons`

個々の武器を定義します。

- `weapon_category_id`：武器カテゴリ
- `name`：武器名。一意
- `weight`
- `power_modifier`：威力補正文字列
- `required_strength`～`required_arcane`：5種類の必要能力値

強化値は武器マスターには保存しません。キャラクターの武器枠に保存します。

### `shield_categories`

盾カテゴリの名前とサイズを定義します。

### `shields`

個々の盾を定義します。

- `shield_category_id`
- `name`：盾名。一意
- `weight`
- `guard_cost`
- `physical_guard`、`phenomenon_guard`
- 5種類の必要能力値

### `talismans`

タリスマンを定義します。

- `name`：一意
- `effect`：効果

### `skills`

スキル本体を定義します。

- `name`：一意
- `classification`：分類
- `timing`：`AC`、`RE`、`TRIGGER`のいずれか
- `target`：対象
- `cost`：コスト表記
- `max_uses`：使用回数上限。NULLは回数制限なし

### `skill_rank_effects`

スキルのランク別効果を保存します。

- 主キー：`skill_id + rank`
- `rank`：1～3
- `effect`：該当ランクの効果

### `skill_sets`

習得単位となるスキルセットを定義します。

- `name`：一意
- `notes`：注意点

### `skill_set_members`

スキルセットに含まれるスキルを表す中間テーブルです。

- 主キー：`skill_set_id + skill_id`
- `position`：セット内の表示順

### `special_items`

冒険全体で所持数を管理する特別アイテムの種類を定義します。ハウスルールによる追加に対応できるよう行形式です。

### `episodes`

エピソードを定義します。

- `name`：一意
- `episode_type`：`MAIN`または`SIDE`
- `episode_number`：数値としてのエピソード番号
- `display_code`：`EP00`や`外伝EP01`などの表示コード。一意
- `malice_level`：悪意適正レベル

メインは0～11、外伝は1～10の番号だけを許可します。

### `spirit_ashes`

遺灰の固定情報を定義します。

- 名前、人数枠、召喚コスト、召喚数、固定レベル
- 運動・感知補正
- 物理・現象カット
- ガード回数、ガード時カット率、回避回数
- 特殊能力
- メイン／サブアクションの名前、対象、ダメージ
- 両アクション共通の特殊効果

遺灰レベルは種類ごとに固定なので、このマスターに保存します。

### `spirit_ash_upgrade_effects`

遺灰の1～5段階の強化効果を保存します。

- 主キー：`spirit_ash_id + upgrade_level`

## 装備・カテゴリとスキルの関連

以下は多対多関係を表す中間テーブルです。

| テーブル | 役割 |
|---|---|
| `armor_skills` | 防具固有の装備スキル |
| `armor_set_skills` | 防具セットが与えるスキル |
| `weapon_skills` | 武器固有の装備スキル |
| `weapon_category_skills` | 武器カテゴリ共通の装備スキル |
| `shield_skills` | 盾固有の装備スキル |
| `skill_weapon_categories` | スキルを使用できる武器カテゴリ |
| `skill_shield_categories` | スキルを使用できる盾カテゴリ |

各テーブルは接続する2つのIDを複合主キーとし、同じ組み合わせの重複を防ぎます。

`skill_weapon_categories`に対象スキルの行がない場合は、武器カテゴリの割り当てなしとして扱います。
`skill_shield_categories`に対象スキルの行がない場合は、盾カテゴリの割り当てなしとして扱います。既存データの移行時はこのテーブルを空で追加するため、既存スキルの意味は変わりません。

## 素性の初期データ

### `origin_initial_skill_sets`

素性が最初から持つスキルセットを表します。

### `origin_initial_weapons`

素性の初期武器を表します。同じ武器を複数設定でき、選択順に採番した`position`で個々の初期装備枠を区別します。APIも重複した`weapon_id`を除去せず、その順序のまま保存します。

### `origin_initial_shields`

素性の初期盾を表します。構造は初期武器と同様です。

### `origin_initial_armors`

素性の初期頭防具・胴体防具を表します。

- 主キー：`origin_id + armor_slot`
- 同じ部位には1種類だけ設定できます。

## 冒険とキャラクター

### `adventures`

複数キャラクターが進捗と所持品を共有する単位です。キャンペーンやセーブデータに相当します。

- `name`：冒険名
- `memo`：共有メモ

### `characters`

キャラクター本体を保存します。

- `adventure_id`：所属する冒険
- `origin_id`：選択した素性
- `name`
- `level`、`runes`、`material_points`
- 8能力値それぞれの成長値
- 8能力値それぞれの追加値

素性の初期能力値は重複保存せず、`origins`を参照します。最終能力値は次のように計算する想定です。

```text
最終能力値 = 素性の初期値 + キャラクターの成長値 + キャラクターの追加値
```

## キャラクターの装備・スキル状態

### `character_weapon_slots`

現在の武器装備枠と、枠に割り当てた強化値を保存します。

- `position`：枠番号
- `weapon_id`：現在の武器。未装備ならNULL
- `reinforcement_level`：枠に割り当てた強化値

`weapon_id`には一意制約がないため、別の`position`へ同じ武器を複数装備できます。

強化値は武器そのものではなく枠に属します。そのため、武器を外しても行を残せば強化値を保持できます。

### `character_shield_slots`

盾装備枠と盾用強化値を保存します。武器枠とは別テーブルなので、武器と盾の強化値を相互に移動できません。

### `character_equipped_armors`

現在装備中の頭防具・胴体防具を保存します。

- 主キー：`character_id + armor_slot`
- 行がなければ、その部位は未装備です。

### `character_equipped_talismans`

現在セット中のタリスマンを保存します。`position`で表示順・装備枠を区別します。行がなければ未装備です。

### `character_learned_skill_sets`

キャラクターが習得済みのスキルセットを保存します。セット内のスキルはランク1で使用可能とみなします。

### `character_equipped_skills`

習得済みスキルセットの中から、現在セットしているスキルを保存します。

- `position`：セット位置
- `rank`：現在ランク。1～3
- 同じスキルは1キャラクターにつき1回だけセット可能

ランク2以上になれるのはセット中のスキルだけです。スキルを外すとこの行を削除するため、保存されていたランクも消え、再セット時はランク1へ戻ります。

## 冒険の共有所持品

以下のテーブルは、冒険が所持するマスターデータと数量を保存します。

| テーブル | 所持対象 |
|---|---|
| `adventure_weapons` | 武器 |
| `adventure_shields` | 盾 |
| `adventure_armors` | 防具 |
| `adventure_talismans` | タリスマン |
| `adventure_skill_sets` | スキルセット |
| `adventure_spirit_ashes` | 遺灰 |

主キーは`adventure_id + 対象マスターID`です。同じ種類を複数所持する場合は`quantity`を増やします。基本的に数量0の行は作らず、行がなければ0個として扱います。

### `adventure_special_items`

冒険ごとの特別アイテム所持数を保存します。

特別アイテムは画面上で常に8種類を表示する可能性があるため、このテーブルだけは`quantity = 0`も許可しています。行がない場合も0個として扱えます。

### `adventure_episode_progress`

冒険ごとのエピソード進捗を保存します。

- `status`：`UNLOCKED`または`COMPLETED`
- 行がなければ未開放
- `COMPLETED`なら開放済みでもある

## 現在入っているデータ

現在、ゲームマスターとして投入済みなのは`special_items`の次の8件だけです。

| ID | 名前 |
|---:|---|
| 1 | 石剣の鍵 |
| 2 | ルーンの弧 |
| 3 | 竜の心臓 |
| 4 | 死の根 |
| 5 | 黄金の種子 |
| 6 | 聖杯瓶の雫 |
| 7 | メモリストーン |
| 8 | お守り袋 |

それ以外のマスターテーブルとプレイデータテーブルは空です。

D1はマイグレーション管理用の内部テーブルも作成します。そのため、`sqlite_master`で数えたテーブル総数はアプリ用42テーブルより多く表示されます。

## 削除時の動作

### 冒険・キャラクター

- 冒険を削除すると、所属キャラクター、共有所持品、進捗も`ON DELETE CASCADE`で削除されます。
- キャラクターを削除すると、そのキャラクターの装備枠・習得・セット状態も削除されます。

### マスターデータ

- 使用中の武器、防具、スキルなどは、参照が残っている間は基本的に削除できません。
- 防具セットを削除した場合、所属防具の`armor_set_id`はNULLになります。
- スキル本体を削除すると、そのスキルのランク効果は削除されます。
- スキルセットを削除すると、そのセット構成は削除されます。

履歴を保持する必要が生じた場合は、物理削除ではなく`is_active`などによる無効化へ変更する余地があります。

## DB側で保証すること

- 主キー・外部キー
- マスター名の一意性
- 中間テーブルの組み合わせ重複防止
- 必須値の`NOT NULL`
- 数量、レベル、成長値などの非負制約
- スキルランク1～3
- 遺灰強化段階1～5
- 防具部位、スキルタイミング、進捗状態などの固定値制約
- エピソード種別ごとの番号範囲

## Worker側で保証すること

複数テーブルをまたぐ次のルールは、将来のWorker APIで検証します。

- 冒険が所持しているものだけをキャラクターが装備する
- 冒険の所持数を超えて同じ装備を割り当てない
- 習得済みスキルセットに含まれるスキルだけをセットする
- セット解除時にランク情報を削除する
- `COMPLETED`へ進める前にエピソードが開放済みであること
- `character_equipped_armors.armor_slot`と参照先防具の部位が一致すること
- タリスマンやスキルの装備数上限

## インデックス

外部キー列は検索やJOINに頻繁に使うため、主キー・UNIQUE制約でカバーされない方向に30個のインデックスを作成しています。

主な対象：

- カテゴリから武器・盾を検索
- 防具セットから防具を検索
- 冒険からキャラクターを検索
- キャラクターから装備状態を検索
- マスターから所持中の冒険を検索
- スキルから装備・カテゴリ・スキルセットとの関連を検索

## マイグレーション操作

### 適用状況の確認

```powershell
npx wrangler d1 migrations list er-data-db --remote
```

### 新しいマイグレーションの作成

```powershell
npx wrangler d1 migrations create er-data-db 変更内容を表す名前
```

既存の適用済みSQLを書き換えず、新しい連番ファイルを作成します。

### ローカルD1へ適用

```powershell
npx wrangler d1 migrations apply er-data-db --local
```

### 本番D1へ適用

```powershell
npx wrangler d1 migrations apply er-data-db --remote
```

`--local`と`--remote`を取り違えないよう注意してください。本番適用前に必ずローカルD1で検証します。

### SQLの実行例

ローカル：

```powershell
npx wrangler d1 execute er-data-db --local --command "SELECT * FROM special_items ORDER BY id;"
```

本番：

```powershell
npx wrangler d1 execute er-data-db --remote --command "SELECT * FROM special_items ORDER BY id;"
```

## 現在のAPI対象と今後の作業

現在のWorker APIは、冒険・キャラクターの基本情報と、素性、防具、武器、盾、スキル、遺灰の新規登録を扱います。関連マスターと中間テーブルはD1の`batch`でまとめて登録します。

今後の対象は、キャラクターの装備・習得スキル、冒険の共有所持品、エピソード進捗、マスター編集・削除です。これらを追加する際は、本節に記載したテーブル間ルールもWorker側で検証します。

本番公開前にCloudflare Accessを設定し、通常パスを卓メンバー、`/admin`・`/admin/*`・`/api/admin/*`を管理者だけに許可します。メールアドレスはD1に保存しません。
