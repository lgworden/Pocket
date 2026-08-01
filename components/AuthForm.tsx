"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Username/password sign-in and sign-up in one form — the two differ only in
// which endpoint they post to and the copy, and a new user shouldn't have to
// find a separate page to get in. Google Sign-In lives below this as a second
// option (see app/login/page.tsx); nothing here requires a Google account.
export default function AuthForm({ invite }: { invite?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const registering = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(registering ? "/api/auth/register" : "/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, invite }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      // A full navigation, not router.push — the session cookie was just set
      // and every page behind it is force-dynamic and server-rendered.
      window.location.href = data.redirect ?? "/";
    } catch {
      setError("Couldn't reach the server — try again?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xs mt-8 space-y-2">
      <input
        type="text"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full bg-transparent border border-slate/25 rounded-full px-4 py-2 text-sm text-center focus:outline-none focus:border-slate/50"
      />
      <input
        type="password"
        name="password"
        autoComplete={registering ? "new-password" : "current-password"}
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full bg-transparent border border-slate/25 rounded-full px-4 py-2 text-sm text-center focus:outline-none focus:border-slate/50"
      />

      {error && <p className="text-xs text-rose pt-1">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !username || !password}
        className="btn-primary w-full disabled:opacity-50"
      >
        {submitting
          ? registering
            ? "Creating your account..."
            : "Signing in..."
          : registering
          ? "Create account"
          : "Sign in"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(registering ? "signin" : "register");
          setError(null);
        }}
        className="w-full text-xs font-ui text-ink/50 underline pt-1"
      >
        {registering ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </form>
  );
}
