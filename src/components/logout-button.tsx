"use client";

import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  async function onClick() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={onClick}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
    >
      ログアウト
    </button>
  );
}
