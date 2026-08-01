# time-card

個人利用向けの勤怠時間管理 Web アプリです。  
Next.js + Supabase + Vercel 構成で、iPhone / PC 両方から同じデータを利用できます。

## 1) 推奨フォルダ構成

```txt
time-card/
  src/
    app/
      api/
        attendance-defaults/route.ts
        attendance/fill-month/route.ts
        attendance/route.ts
        csv/route.ts
      auth/confirm/route.ts
      login/page.tsx
      record/page.tsx
      records/page.tsx
      settings/page.tsx
      summary/page.tsx
      layout.tsx
      page.tsx
    components/
      attendance-defaults-form.tsx
      attendance-form.tsx
      attendance-table.tsx
      fill-month-button.tsx
      login-form.tsx
      logout-button.tsx
      monthly-timesheet.tsx
    lib/
      attendance-defaults-map.ts
      attendance-fields.ts
      attendance-map.ts
      calendar-jp.ts
      commute-types.ts
      csv.ts
      day-codes.ts
      time.ts
      work-system.ts
      supabase/
        client.ts
        middleware.ts
        server.ts
    types/
      attendance-defaults.ts
      attendance.ts
  supabase/
    schema.sql
    rls.sql
    migration_timesheet_columns.sql
    migration_commute_type.sql
    migration_attendance_defaults.sql
    migration_break2.sql
    migration_work_system.sql
  middleware.ts
  .env.example
```

## 2) 必要パッケージ

- `next`, `react`, `react-dom`
- `typescript`
- `tailwindcss`, `@tailwindcss/postcss`
- `@supabase/supabase-js`
- `@supabase/ssr`

## 3) Next.js 初期セットアップ

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
npm install @supabase/ssr @supabase/supabase-js
```

## 4) Supabase 接続設定

1. Supabase プロジェクトを作成
2. `Project Settings > API` から URL と anon key を確認
3. `.env.local` を作成し以下を設定

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. ローカル起動

```bash
npm run dev
```

## 5) DB作成SQL

`supabase/schema.sql` を SQL Editor で実行してください。

### 既に DB を作成済みの場合（カラム追加）

以前の `schema.sql` のみ適用済みの場合は、`supabase/migration_timesheet_columns.sql` を SQL Editor で実行し、勤務表用カラム（勤怠区分・残業・各休暇日数など）を追加してください。

その後、出勤区分用に `supabase/migration_commute_type.sql` を実行してください（`commute_type` 列）。

平日デフォルトと一括登録用に `supabase/migration_attendance_defaults.sql` を実行してください（`attendance_defaults` テーブルと RLS）。**新規に更新後の `schema.sql` と `rls.sql` を流した場合はこのマイグレーションは不要**です（テーブル定義が重複するため）。

2つ目の休憩用に `supabase/migration_break2.sql` を実行してください（`break2_start` / `break2_end` 列）。個別編集画面でのみ入力でき、勤務表の「休憩」列は2組の合計分数を表示します。

勤務体系（通常 / 裁量労働制）と休日出勤分数用に `supabase/migration_work_system.sql` を実行してください（`attendance_defaults.work_system`、`attendance_records.holiday_work_minutes`）。

月別の勤務体系上書き用に `supabase/migration_month_work_systems.sql` を実行してください（`attendance_defaults.month_work_systems`）。

## 6) RLS設定SQL

`supabase/rls.sql` を SQL Editor で実行してください。

## 7) 画面実装内容

- `/login` : メールログイン（Magic Link）
- `/` : 月次勤務表（全日付行・フッターに勤務・残業などの合計・前月/次月ナビ）。**当月・来月表示時**「空白を初期値で埋める」で、土日祝を除く平日かつ未登録日にだけ行を追加
- `/settings` : 勤務体系（通常 / 裁量労働制）と平日デフォルト（出退勤・休憩・勤怠区分・出勤区分）。保存成功後は勤務表へ戻る
- `/record?date=YYYY-MM-DD` : 1日分の編集（保存は従来どおり upsert）。休憩は最大2組まで入力可能（勤務表は合算表示）
- `/records` : 当月の勤務表（`/`）へリダイレクト
- `/summary` : 勤務表（`/`）へリダイレクトのみ（ブックマーク等の旧 URL 用。月別集計画面はありません）

勤怠区分（`day_code`）は次の7種の **1文字コード** で保存します: 勤・残・前・後・有・特・リ（定義は `src/lib/day-codes.ts`）。欠・振は廃止済みですが、旧データの表示・CSV では名称を付けて出力します。裁量労働制では半休（前・後）は選択肢に出しません。

出勤区分（`commute_type`）は在宅・出社・社外・出張または未設定（`null`）。選択肢の順序は `src/lib/commute-types.ts` のとおりです。

## 8) 勤務時間・残業の計算

`src/lib/time.ts` の `calculateWorkMinutes` / `calculateAttendanceBreakdown` で勤務・残業・休日出勤・みなしを計算しています。

退勤時刻が出勤時刻より早い場合（例: 22:00 出勤・翌06:00 退勤）は、**翌日までの同一勤務**として 24 時間分を加算して区間を作り、休憩はその区間に載るオフセットで重なり分だけ控除します（連続 48 時間超の勤務は想定外です）。

```txt
勤務時間 ≒ (退勤の絶対位置 - 出勤) - (休憩と勤務の重なり)
```

### 休日の区分

- **法定休日**: 日曜日 → 休日出勤
- **法定外休日**: 土曜日、および日曜以外の国民の祝日（振替含む）→ 通常は残業 / 裁量は休日出勤
- **日跨ぎ勤務**: 退勤が出勤より早い（日付をまたぐ）場合、**0:00 で暦日分割**し、各暦日の区分で残業 / 休日出勤へ振り分ける
  - 例: 土曜 22:00〜日曜 6:00 → 土曜分は法定外残業、日曜分は法定休日出勤
  - 例: 日曜 22:00〜月曜 6:00 → 日曜分は法定休日出勤、月曜分は平日ルール
  - 例: 金曜 22:00〜土曜 6:00 → 金曜分は平日ルール、土曜分は法定外残業
  - 例: 平日〜翌祝日 → 平日分は平日ルール、祝日分は法定外（裁量は休出）

### 月ごとの勤務体系

勤務表ヘッダーで、対象月を「通常」または「裁量労働制」に切り替えられます（`attendance_defaults.month_work_systems` に保存）。

組み込み初期値:

- **2026年6月以前**: 通常
- **2026年7月**: 裁量労働制
- **それ以外**: 設定画面の勤務体系

優先順位は「月別の選択 → 組み込み初期値 → 設定の勤務体系」です。

`supabase/migration_month_work_systems.sql` を SQL Editor で実行してください（`month_work_systems` 列）。

### みなし残業（裁量労働制のみ・仕様書 v0.1）

- 所定労働日に1分以上の実勤務がある日: **みなし労働 9:30**、**みなし法定外 1:30**（実勤務の長短に依存しない）
- **実労働の 9:30 超**は参考値のみ（法休除・45h 判定へ自動加算しない）
- **土曜・祝日**: 所定休日の実労働（法休除の会社集計へ加算）
- **日曜**: 法定休日労働（45h から除外）
- **社内みなし法定外（暫定）** = 法休除 + 法定休日
- 勤務表フッターは **実態 / 会社制度・給与 / 法令・36協定** の3ブロック
- 通常勤務体系ではみなし関連は計算・表示しない

警告（裁量時）: 月45時間超過、単月100時間未満、80時間（社内・法令を区別表示）、2〜6か月平均。未確定式は「暫定」と表示。

### 通常（`work_system = standard`）

- 日曜（法定休日）: 勤務時間のすべてを休日出勤
- 土曜・祝日（法定外休日）・勤怠区分「残」: 勤務時間のすべてを残業（法定外）
- 「前」（午前半休）: 18時以降の勤務のみ残業（休憩と重なる分は除く）
- 「後」（午後半休）: 勤務時間から3時間を超える分が残業
- 上記以外の平日: 8時間を超える分が残業

### 裁量労働制（`work_system = discretionary`）

- 平日: 8時間を超える分が残業（半休ルールなし）
- 土日祝・勤怠区分「残」: 勤務時間のすべてを休日出勤（残業には含めない）
- 平日かつ勤務1時間以上: 勤怠区分を自動で「勤」（有・特・リ・残は上書きしない）
- 設定切替だけでは過去データを一括再計算しない。日次の保存・一括登録から新ルールを適用

祝日判定は `japanese-holidays` を使用しています（`src/lib/calendar-jp.ts`）。

## 9) CSV出力処理

- API: `GET /api/csv`
- 実装: `src/app/api/csv/route.ts`, `src/lib/csv.ts`
- 画面の「CSV出力」からダウンロード可能

## 10) Vercel デプロイ手順

1. GitHub に push
2. Vercel で新規プロジェクト import
3. Environment Variables に以下を設定
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy 実行
5. Supabase Auth の `URL Configuration` に Vercel の本番 URL を登録
   - `Site URL`: `https://<your-app>.vercel.app`
   - `Redirect URL`: `https://<your-app>.vercel.app/auth/confirm`

## time型を採用した理由（timestamp型との比較）

今回の要件は「日ごとに手入力する勤怠」のため、`work_date(date)` + 各時刻 `time` が最もシンプルです。

- 初心者が理解しやすい（勤務日と時刻が直感的）
- 月ごとの合計や一覧が書きやすい
- タイムゾーンの混乱を避けやすい

将来、日跨ぎ勤務や自動打刻を強化する場合は `timestamp with time zone` への拡張を検討できます。
