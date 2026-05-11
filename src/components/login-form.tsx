"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/confirm`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);
    setMessage(error ? error.message : "ログインメールを送信しました。");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <h1 className="text-xl font-semibold">ログイン</h1>
      <p className="text-sm text-slate-600">メールアドレスでログインリンクを送信します。</p>
      <label className="text-sm">
        メールアドレス
        <input
          type="email"
          className="mt-1 w-full rounded-md border px-3 py-2"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "送信中..." : "ログインメール送信"}
      </button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
