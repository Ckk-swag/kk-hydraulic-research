// First-party aggregate usage. A random browser id is only used to estimate active browsers.
type Event = "page_view" | "search" | "favorite_add" | "favorite_remove" | "export";
const KEY = "kaikai-water-usage-browser-v1";

function browserId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function trackUsage(event: Event, options: { path?: string; term?: string } = {}): void {
  if (typeof window === "undefined") return;
  const visitorId = browserId();
  if (!visitorId) return;
  void fetch("/api/usage/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, visitorId, path: options.path ?? window.location.pathname, term: options.term }),
    keepalive: true,
  }).catch(() => {});
}
