import { redirect } from "next/navigation";
import { getTodayYmdJapan } from "@/lib/calendar-jp";
import { createClient } from "@/lib/supabase/server";

export default async function RecordsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = getTodayYmdJapan();
  redirect(`/?year=${today.year}&month=${today.month}`);
}
