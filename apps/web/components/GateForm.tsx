"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function GateForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // A full navigation, so the proxy re-runs and sees the new cookie.
        window.location.href = "/";
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "something went wrong");
      setPassword("");
      // Keep the keyboard up on a phone; losing focus meant tapping the field again.
      document.getElementById("gate-pw")?.focus();
    } catch {
      setError("no connection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="gate-form" onSubmit={submit}>
      <label className="eyebrow" htmlFor="gate-pw">Password</label>
      <input
        id="gate-pw"
        className="gate-input"
        type="password"
        value={password}
        autoFocus
        autoComplete="current-password"
        onChange={(e) => { setPassword(e.target.value); setError(null); }}
        aria-invalid={!!error}
        aria-describedby={error ? "gate-error" : undefined}
      />
      <button className="btn btn-primary btn-lg" type="submit" disabled={!password || busy}>
        {busy ? "Checking…" : "Enter"}
      </button>
      <p id="gate-error" className="gate-error" role="status">{error ?? " "}</p>
    </form>
  );
}
