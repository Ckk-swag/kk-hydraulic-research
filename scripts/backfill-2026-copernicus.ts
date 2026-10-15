// One-time, bounded 2026 research-paper backfill from four publisher-owned volume pages.
// Preview with: node scripts/backfill-2026-copernicus.ts
// Apply in the worker container with --apply. Existing URLs are deduplicated by ingestItems.
import { readFileSync } from "node:fs";
import { SITE } from "@aihot/industry/site";
import { fromHtml } from "../packages/backend/src/sources/web-list.ts";
import { ingestItems } from "../packages/backend/src/ingest/items.ts";
import { closeDb } from "../packages/backend/src/db.ts";

const specs = [
  { id: "hess-recent-papers", archive: "https://hess.copernicus.org/articles/30/", max: 24 },
  { id: "ocean-science-papers", archive: "https://os.copernicus.org/articles/22/", max: 20 },
  { id: "earth-surface-dynamics-papers", archive: "https://esurf.copernicus.org/articles/14/", max: 14 },
  { id: "geoscientific-model-development-papers", archive: "https://gmd.copernicus.org/articles/19/", max: 12 },
] as const;

const sourceData = JSON.parse(readFileSync("industry/sources.json", "utf8")) as {
  sources: Array<{ id: string; name: string; kind: "web_list"; config: Record<string, unknown>; participation_mode: "editorial" }>;
};

const patterns: Array<[RegExp, number]> = [
  [/estuar|tidal|deltaic|river[\s–-]?sea|coastal exchange|saltwater intrusion/i, 8],
  [/sediment|morphodynam|bedform|turbidity|riverbank erosion|coastal erosion|river incision/i, 7],
  [/hydrodynam|hydraulic|river network|river channel|distributary|streamflow|river discharge/i, 5],
  [/flood|inundation|urban water|drainage/i, 3],
  [/numerical|model|simulation|calibrat|validat|observation|measurement|remote sensing/i, 1],
];

function relevance(title: string): number {
  if (/cloud microphysics|aerosol/i.test(title)) return 0;
  if (/coral|chlorophyll|aerosol|cloud microphysics|silicate weathering|glacier|snow|sea ice/i.test(title) && !/estuar|tidal|river|sediment|flood/i.test(title)) return 0;
  return patterns.reduce((sum, [pattern, points]) => sum + (pattern.test(title) ? points : 0), 0);
}

function choose<T extends { title: string; publishedAt: Date | null; score: number }>(items: T[], max: number): T[] {
  const byRank = (a: T, b: T) => b.score - a.score || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
  const groups = [0, 1, 2].map((quarter) => items.filter((x) => x.publishedAt && Math.floor(x.publishedAt.getUTCMonth() / 3) === quarter).sort(byRank));
  const quota = Math.ceil(max / 3);
  const chosen = groups.flatMap((group) => group.slice(0, quota));
  const seen = new Set(chosen.map((x) => x.title));
  if (chosen.length < max) chosen.push(...items.filter((x) => !seen.has(x.title)).sort(byRank).slice(0, max - chosen.length));
  return chosen.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)).slice(0, max);
}

async function main() {
  const apply = process.argv.includes("--apply");
  let planned = 0;
  let created = 0;
  for (const spec of specs) {
    const source = sourceData.sources.find((x) => x.id === spec.id);
    if (!source) throw new Error(`source not configured: ${spec.id}`);
    const response = await fetch(spec.archive, {
      headers: { "user-agent": `${SITE.crawlerName}/1.0`, accept: "text/html" },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`${spec.archive}: HTTP ${response.status}`);
    const candidates = fromHtml(await response.text(), spec.archive, {
      ...source,
      config: { ...source.config, url: spec.archive },
    } as never);
    const eligible = candidates
      .filter((x) => x.publishedAt && x.publishedAt.getUTCFullYear() === 2026 && x.publishedAt.getTime() <= Date.now() + 86400_000)
      .map((x) => ({ ...x, score: relevance(x.title) }))
      .filter((x) => x.score >= 5);
    const picked = choose(eligible, spec.max);
    planned += picked.length;
    const quarters = [1, 2, 3].map((n) => picked.filter((x) => x.publishedAt && Math.floor(x.publishedAt.getUTCMonth() / 3) + 1 === n).length);
    console.log(`${spec.id}: archive=${candidates.length}, relevant=${eligible.length}, chosen=${picked.length}, Q1/Q2/Q3=${quarters.join("/")}`);
    for (const item of picked.slice(0, apply ? 0 : 8)) console.log(`  ${item.publishedAt!.toISOString().slice(0, 10)} [${item.score}] ${item.title}`);
    if (!apply) continue;
    for (let start = 0; start < picked.length; start += 25) {
      const batch = picked.slice(start, start + 25);
      const result = await ingestItems({
        sourceId: source.id,
        sourceName: source.name,
        items: batch.map((x) => ({
          title: x.title,
          url: x.url,
          publishedAt: x.publishedAt!.toISOString(),
          raw: { _aihot: { backfill: true }, researchSelection: "2026-curated-title" },
        })),
      });
      created += result.created;
      console.log(`  stored batch ${start + 1}-${start + batch.length}, new=${result.created}`);
    }
  }
  console.log(`2026 curated backfill: planned=${planned}, newly stored=${created}, apply=${apply}`);
}

try {
  await main();
} finally {
  await closeDb();
}
