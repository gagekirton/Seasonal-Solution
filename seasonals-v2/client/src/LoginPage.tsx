import { useState, type FormEvent } from "react";
import "./login.css";

/**
 * Owner sign-in page (added in the 2026-11-11 rebuild, replacing the Manus
 * OAuth redirect). Posts to /api/auth/login on the same origin; on success the
 * server sets the session cookie and we continue to `next` (default /admin).
 * Rendered by PublicPage for /login, so it must stay SSR-safe: nothing
 * browser-only runs during render.
 */
export function LoginPage() {
  const [next] = useState<string>(() => {
    if (typeof window === "undefined") return "/admin";
    const value = new URLSearchParams(window.location.search).get("next");
    return value && value.startsWith("/") && !value.startsWith("//")
      ? value
      : "/admin";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        window.location.assign(next);
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Sign-in could not be completed.");
    } catch {
      setError("Sign-in could not be completed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <p className="login-eyebrow">Seasonal Solutions</p>
        <h1 className="login-title">Owner sign-in</h1>
        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p className="login-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="button button-primary login-submit"
          type="submit"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <p className="login-back">
          <a href="/">Back to website</a>
        </p>
      </form>
    </main>
  );
}
