import { sql } from "../db.ts";

export async function usageOverview(days: number) {
  const windowDays = [1, 7, 30, 90].includes(days) ? days : 7;
  const since = new Date(Date.now() - windowDays * 86400_000);
  const [totals] = await sql<{
    page_views: number; active_browsers: number; searches: number; favorite_adds: number; favorite_removes: number; exports: number;
  }[]>`
    SELECT count(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
      count(DISTINCT visitor_hash) FILTER (WHERE event_type = 'page_view')::int AS active_browsers,
      count(*) FILTER (WHERE event_type = 'search')::int AS searches,
      count(*) FILTER (WHERE event_type = 'favorite_add')::int AS favorite_adds,
      count(*) FILTER (WHERE event_type = 'favorite_remove')::int AS favorite_removes,
      count(*) FILTER (WHERE event_type = 'export')::int AS exports
    FROM usage_events WHERE occurred_at >= ${since}`;
  const daily = await sql<{ day: string; page_views: number; active_browsers: number; searches: number; favorite_adds: number; exports: number }[]>`
    SELECT (occurred_at AT TIME ZONE 'Asia/Shanghai')::date::text AS day,
      count(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
      count(DISTINCT visitor_hash) FILTER (WHERE event_type = 'page_view')::int AS active_browsers,
      count(*) FILTER (WHERE event_type = 'search')::int AS searches,
      count(*) FILTER (WHERE event_type = 'favorite_add')::int AS favorite_adds,
      count(*) FILTER (WHERE event_type = 'export')::int AS exports
    FROM usage_events WHERE occurred_at >= ${since}
    GROUP BY 1 ORDER BY 1 DESC`;
  const terms = await sql<{ term: string; uses: number }[]>`
    SELECT search_term AS term, count(*)::int AS uses FROM usage_events
    WHERE occurred_at >= ${since} AND event_type = 'search' AND search_term IS NOT NULL
    GROUP BY search_term ORDER BY uses DESC, term LIMIT 30`;
  return { days: windowDays, totals, daily, terms };
}
