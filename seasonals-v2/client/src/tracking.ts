/**
 * HANDOFF: Cookieless first-party tracking via sendBeacon to /api/track. Do not add third-party trackers or cookies.

 */
const EXCLUDE_KEY = "seasonal-solutions:exclude-stats";
const SESSION_KEY = "seasonal-solutions:stats-session";

export function excludeThisDeviceFromStats(exclude: boolean) {
  try {
    if (exclude) localStorage.setItem(EXCLUDE_KEY, "1");
    else localStorage.removeItem(EXCLUDE_KEY);
  } catch {
    // Storage may be unavailable; stats simply remain unchanged.
  }
}

export function isDeviceExcludedFromStats(): boolean {
  try {
    return localStorage.getItem(EXCLUDE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Sends an aggregate page view; no cookies or identifiers are used. */
export function trackPageView(path: string) {
  if (/^\/(admin|pay)(\/|$)/.test(path) || isDeviceExcludedFromStats()) return;
  let landing = false;
  try {
    landing = sessionStorage.getItem(SESSION_KEY) !== "1";
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    landing = false;
  }
  const params = new URLSearchParams(window.location.search);
  let referrer = "";
  try {
    if (
      document.referrer &&
      new URL(document.referrer).host !== window.location.host
    )
      referrer = document.referrer.slice(0, 500);
  } catch {
    referrer = "";
  }
  const body = JSON.stringify({
    path,
    landing,
    referrer,
    utmSource: params.get("utm_source")?.slice(0, 120) ?? "",
    utmMedium: params.get("utm_medium")?.slice(0, 60) ?? "",
  });
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/track", blob))
      return;
  } catch {
    // Fall back to fetch below.
  }
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
