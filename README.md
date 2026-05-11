# time-card

個人利用向けの勤怠時間管理 Web アプリです。  
Next.js + Supabase + Vercel 構成で、iPhone / PC 両方から同じデータを利用できます。

## 1) 推奨フォルダ構成

```txt
time-card/
  src/
    app/
      api/
        attendance/route.ts
        csv/route.ts
      auth/confirm/route.ts
      login/page.tsx
      records/page.tsx
      summary/page.tsx
      layout.tsx
      page.tsx
    components/
      attendance-form.tsx
      attendance-table.tsx
      login-form.tsx
      logout-button.tsx
      monthly-summary.tsx
    lib/
      csv.ts
      time.ts
      supabase/
        client.ts
        middleware.ts
        server.ts
    types/
      attendance.ts
  supabase/
    schema.sql
    rls.sql
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

## 6) RLS設定SQL

`supabase/rls.sql` を SQL Editor で実行してください。

## 7) 画面実装内容

- `/login` : メールログイン（Magic Link）
- `/` : メイン画面（勤務入力 + 今日の勤務時間）
- `/records` : 日別一覧（編集ボタン付き）
- `/summary` : 月別集計（勤務日数 / 合計 / 平均）

## 8) 勤務時間計算ロジック

`src/lib/time.ts` の `calculateWorkMinutes` で計算しています。

計算式:

```txt
勤務時間 = (退勤 - 出勤) - (休憩終了 - 休憩開始)
```

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
