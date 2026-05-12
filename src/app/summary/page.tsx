import { redirect } from "next/navigation";

/** 旧 URL `/summary` は勤務表へ誘導（集計画面は廃止） */
export default function SummaryRedirectPage() {
  redirect("/");
}
