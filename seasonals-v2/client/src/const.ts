export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the owner sign-in. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It navigates to the app's own /login page (email + password, see
// server/_core/auth.ts), carrying the current admin path as `next` so the
// owner lands back where they were headed after signing in. It returns void
// by design, so there is no URL to stash across renders. Do NOT call it
// during render.
export const startLogin = () => {
  const next = window.location.pathname.startsWith("/admin")
    ? window.location.pathname
    : "/admin";
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
};
