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
      monthly-summary.tsx
      monthly-timesheet.tsx
    lib/
      attendance-defaults-map.ts
      attendance-fields.ts
      attendance-map.ts
      calendar-jp.ts
      commute-types.ts
      csv.ts
      time.ts
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

## 6) RLS設定SQL

`supabase/rls.sql` を SQL Editor で実行してください。

## 7) 画面実装内容

- `/login` : メールログイン（Magic Link）
- `/` : 月次勤務表（全日付行・フッター集計・前月/次月ナビ）。**当月表示時のみ**「当月の空白を初期値で埋める」で、土日祝を除く平日かつ未登録日にだけ行を追加
- `/settings` : 平日デフォルト（出退勤・休憩・勤怠区分・出勤区分）。一括登録と保存用
- `/record?date=YYYY-MM-DD` : 1日分の編集（保存は従来どおり upsert）
- `/records` : 当月の勤務表（`/`）へリダイレクト
- `/summary` : 月別集計（勤務・残業の月合計と平均）。残業は勤務日・勤怠区分・出退時刻から自動計算

勤怠区分（`day_code`）は次の7種の **1文字コード** で保存します: 勤・残・前・後・有・特・リ（定義は `src/lib/day-codes.ts`）。欠・振は廃止済みですが、旧データの表示・CSV では名称を付けて出力します。

出勤区分（`commute_type`）は在宅・出社・社外・出張または未設定（`null`）。選択肢の順序は `src/lib/commute-types.ts` のとおりです。

## 8) 勤務時間・残業の計算

`src/lib/time.ts` の `calculateWorkMinutes` で勤務時間を計算しています。

```txt
勤務時間 = (退勤 - 出勤) - (休憩終了 - 休憩開始)
```

残業（`calculateOvertimeMinutes`）は次のルールです（定時は8時間）。

- 土曜・日曜・国民の祝日（振替休日含む）: 勤務時間のすべてを残業
- 勤怠区分「残」: 同上（全日残業扱い）
- 「前」（午前半休）: 18時以降の勤務のみ残業（休憩と重なる分は除く）
- 「後」（午後半休）: 勤務時間から3時間を超える分が残業
- 上記以外の平日: 8時間を超える分が残業

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
- 月次集計が書きやすい
- タイムゾーンの混乱を避けやすい

将来、日跨ぎ勤務や自動打刻を強化する場合は `timestamp with time zone` への拡張を検討できます。
