// One-time, bounded historical import for the July–August 2026 gap before the public launch.
// Preview: node scripts/backfill-recent-quarter.ts
// Apply:   node scripts/backfill-recent-quarter.ts --apply
// Publisher-owned archive URLs and original dates are kept; existing article URLs are skipped.
import { readFileSync } from "node:fs";
import { SITE } from "@aihot/industry/site";
import { isoWeekLabel } from "@aihot/contracts/time";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { queueProcessing } from "@aihot/backend/jobs/content";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { fromHtml } from "@aihot/backend/sources/web-list";

const FROM = "2026-07-01";
const UNTIL = "2026-09-01";
const SPECS = [
  { id: "hess-recent-papers", url: "https://hess.copernicus.org/articles/30/", perWeek: 5, minRank: 1 },
  { id: "ocean-science-papers", url: "https://os.copernicus.org/articles/22/", perWeek: 2, minRank: 5 },
  { id: "earth-surface-dynamics-papers", url: "https://esurf.copernicus.org/articles/14/", perWeek: 2, minRank: 5 },
] as const;

const sourceData = JSON.parse(readFileSync("industry/sources.json", "utf8")) as {
  sources: Array<{ id: string; name: string; config: Record<string, unknown> }>;
};

const signals: Array<[RegExp, number]> = [
  [/estuar|tidal|delta|sediment|morphodynam|hydrodynam|hydraulic|flood|inundat/i, 8],
  [/river|streamflow|runoff|reservoir|dam|urban|groundwater|water quality|discharge/i, 5],
  [/hydrolog|rainfall|precipitation|drought|infiltration|water balance|water yield|soil moisture|catchment|flow spell|nutrient load/i, 3],
  [/model|simulat|predict|machine learning|deep learning|observation|monitor|remote sensing/i, 1],
];
function rank(title: string) {
  return signals.reduce((sum, [pattern, points]) => sum + (pattern.test(title) ? points : 0), 0);
}

async function main() {
  const apply = process.argv.includes("--apply");
  let planned = 0;
  let created = 0;
  for (const spec of SPECS) {
    const source = sourceData.sources.find((s) => s.id === spec.id);
    if (!source) throw new Error(`missing source ${spec.id}`);
    const response = await fetch(spec.url, {
      headers: { "user-agent": `${SITE.crawlerName}/1.0`, accept: "text/html" },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`${spec.url}: HTTP ${response.status}`);
    const parsed = fromHtml(await response.text(), spec.url, { ...source, config: { ...source.config, url: spec.url } } as never);
    const byWeek = new Map<string, typeof parsed>();
    for (const item of parsed) {
      if (!item.publishedAt) continue;
      const date = item.publishedAt.toISOString().slice(0, 10);
      if (date < FROM || date >= UNTIL) continue;
      const week = isoWeekLabel(date);
      byWeek.set(week, [...(byWeek.get(week) ?? []), item]);
    }
    const chosen = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([week, items]) => {
      const picked = items.filter((item) => rank(item.title) >= spec.minRank
          && (spec.id !== "ocean-science-papers" || /estuar|tidal|sediment|coastal|storm surge|freshwater discharge|\briver\b/i.test(item.title)))
        .sort((a, b) => rank(b.title) - rank(a.title) || a.title.localeCompare(b.title)).slice(0, spec.perWeek);
      console.log(`${source.name} ${week}: archive=${items.length}, chosen=${picked.length}`);
      return picked;
    });
    planned += chosen.length;
    const existing = chosen.length
      ? new Set((await sql<{ url: string }[]>`SELECT url FROM articles WHERE url IN ${sql(chosen.map((x) => x.url))}`).map((x) => x.url))
      : new Set<string>();
    const fresh = chosen.filter((item) => !existing.has(item.url));
    console.log(`${spec.id}: parsed=${parsed.length}, chosen=${chosen.length}, new=${fresh.length}`);
    for (const item of fresh.slice(0, 8)) console.log(`  ${item.publishedAt!.toISOString().slice(0, 10)} [${rank(item.title)}] ${item.title}`);
    if (!apply) continue;
    for (const item of fresh) {
      const result = await upsertMaterial({
        ...item, sourceId: source.id, via: "fetch", backfill: "2026-quarter-archive",
        raw: { archiveUrl: spec.url, selection: "bounded-weekly-archive" },
      });
      if (result.created) {
        created += 1;
        await queueProcessing(result.articleId);
      }
    }
  }
  console.log(`quarter archive: planned=${planned}, created=${created}, apply=${apply}`);
}

try { await main(); }
finally { await stopBoss(); await closeDb(); }
