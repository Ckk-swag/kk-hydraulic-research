// Fill the three most recently completed calendar months and their adjacent completed weeks.
// Preview without model calls: node scripts/backfill-reports-quarter.ts
// Apply sequentially:          node scripts/backfill-reports-quarter.ts --apply
// Existing nonempty issues are left alone; an empty issue is revised with its original kept.
import { closeDb, sql } from "@aihot/backend/db";
import { REPORT_VERSION, candidates, composeMonthly, composeWeekly } from "@aihot/backend/reports/compose";
import { beijingMidnight, isoWeekRange } from "@aihot/contracts/time";

const periods = [
  ...Array.from({ length: 13 }, (_, i) => ({ kind: "weekly" as const, key: `2026-W${String(i + 27).padStart(2, "0")}` })),
  ...["2026-06", "2026-07", "2026-08"].map((key) => ({ kind: "monthly" as const, key })),
];

function bounds(kind: "weekly" | "monthly", key: string) {
  if (kind === "weekly") {
    const range = isoWeekRange(key);
    if (!range) throw new Error(`invalid week ${key}`);
    return { start: beijingMidnight(range.start), end: beijingMidnight(range.end).getTime() + 86400_000 };
  }
  const [year, month] = key.split("-").map(Number) as [number, number];
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start: beijingMidnight(`${key}-01`), end: beijingMidnight(next).getTime() };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const redoRelated = process.argv.includes("--redo-related");
  let generated = 0;
  for (const period of periods) {
    const [existing] = await sql<{ selected: number; related: number; version: string | null }[]>`
      SELECT coalesce((content->'metrics'->>'selectedCount')::int, 0) AS selected,
             coalesce((content->'metrics'->>'relatedCount')::int, 0) AS related,
             content->'generator'->>'version' AS version
      FROM reports WHERE kind = ${period.kind} AND key = ${period.key}`;
    const { start, end } = bounds(period.kind, period.key);
    const selected = await candidates(start, new Date(end), { includeBackfill: true, visibleAt: new Date() });
    const related = selected.length ? 0 : (await candidates(start, new Date(end), { includeBackfill: true, selectedOnly: false, visibleAt: new Date() })).length;
    const skip = !!existing && existing.selected === selected.length && existing.related === Math.min(related, 12)
      && (existing.selected > 0 || existing.related > 0)
      && !(redoRelated && existing.related > 0 && existing.version !== REPORT_VERSION);
    console.log(`${period.kind}:${period.key} selected=${selected.length} related=${related} existing=${existing ? `${existing.selected}/${existing.related}` : "none"} ${skip ? "skip" : "generate"}`);
    if (!apply || skip) continue;
    const result = period.kind === "weekly"
      ? await composeWeekly(period.key, "historical-backfill")
      : await composeMonthly(period.key, "historical-backfill");
    generated += 1;
    console.log(`  saved ${result.key}, entries=${result.entries}`);
  }
  console.log(`historical reports generated=${generated}, apply=${apply}`);
}

try { await main(); }
finally { await closeDb(); }
