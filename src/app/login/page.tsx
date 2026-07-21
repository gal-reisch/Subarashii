"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-full flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-5xl text-accent">Subarashii</h1>
        <p className="mt-3 text-muted">Ella&apos;s recipe box.</p>

        {sent ? (
          <div className="mt-10 rounded-[28px] bg-card p-6 shadow-[0px_16px_40px_rgba(0,0,0,0.08)]">
            <p className="text-lg font-bold">Check your email ✨</p>
            <p className="mt-2 text-sm text-muted">
              We sent a magic link to <strong>{email}</strong>. Tap it to sign
              in — no password needed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-2xl bg-card px-4 py-3.5 text-center shadow-[0px_6px_20px_rgba(0,0,0,0.05)] outline-none focus:shadow-[0px_0px_0px_2px_var(--accent)]"
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send me a magic link"}
            </Button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
