import { track } from "@vercel/analytics";

/**
 * Client errors, to Vercel: a line in the runtime logs (POST /api/erreurs,
 * readable in Observability) and an "Erreur" event in Web Analytics. Server
 * errors go through instrumentation.ts. At most 5 reports per page load.
 */
let sent = 0;
const seen = new Set<string>();

export function reportClientError(error: unknown, source: string) {
  if (typeof window === "undefined" || sent >= 5) return;
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  const key = `${source}:${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent += 1;

  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : undefined;
  const body = JSON.stringify({
    source,
    message,
    digest,
    stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
    path: window.location.pathname,
    userAgent: navigator.userAgent,
  });

  try {
    if (!navigator.sendBeacon?.("/api/erreurs", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/erreurs", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    }
    track("Erreur", { source, path: window.location.pathname, message: message.slice(0, 200) });
  } catch {
    // Reporting must never break the page.
  }
}
