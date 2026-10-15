// Daily, weekly and monthly reports. Windows are Beijing calendar based and written into the report;
// missed schedule points are caught up; regeneration creates a revision. The editors' prompts are in
// the industry pack (industry/prompts/report-*.md), the sections follow its categories.
import { z } from "zod";
import { SITE } from "@aihot/industry/site";
import { CATEGORIES } from "@aihot/industry/taxonomy";
import { promptText, promptVersion } from "../editorial/prompts.ts";
import { modelFor } from "../editorial/models.ts";
import { addDays, beijingDate, beijingMidnight, isoWeekLabel, isoWeekRange } from "@aihot/contracts/time";
import { sql } from "../db.ts";
import { chatJson } from "../providers/llm.ts";
import { completeReceipt } from "../providers/receipts.ts";

export const REPORT_VERSION = promptVersion("report-daily-lead", "report-period", "report-period-related");

const SECTION_OF: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.section]));
const SECTION_ORDER = [...new Set(CATEGORIES.map((c) => c.section))];
/** Where an item without a category goes. */
const DEFAULT_SECTION = SECTION_OF.industry ?? SECTION_ORDER.at(-1)!;

export interface ReportEntry {
  itemId: string;
  factId: string | null;
  storyPublicId: string | null;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  sourceId: string;
  firstParty: boolean;
  role: string;
  score: number | null;
  publishedAt: string;
}

export interface Candidate extends ReportEntry {
  category: string | null;
  factKey: string;
}

function roleOf(kind: string, firstParty: boolean): string {
  if (firstParty) return kind === "x_search" ? "X·官方" : "官方";
  if (kind === "x_search") return "X·KOL";
  if (kind === "mp_account") return "公众号";
  return "媒体";
}

export async function candidates(start: Date, end: Date, options: { includeBackfill?: boolean; selectedOnly?: boolean; visibleAt?: Date } = {}): Promise<Candidate[]> {
  const selectedOnly = options.selectedOnly !== false;
  const includeBackfill = options.includeBackfill === true;
  const visibleAt = options.visibleAt ?? end;
  const rows = await sql<{
    id: string; title: string; summary: string | null; url: string; category: string | null; score: number | null; first_party: boolean;
    source_id: string; source_name: string; source_kind: string; fact_public_id: string | null; story_public_id: string | null; at: Date; backfill: boolean;
  }[]>`
    SELECT p.article_id AS id, p.title, p.summary, p.url, p.category, p.score, p.first_party, s.id AS source_id, s.name AS source_name,
           s.kind AS source_kind, f.public_id AS fact_public_id, st.public_id::text AS story_public_id, p.timeline_at AS at, p.backfill
    FROM publications p JOIN sources s ON s.id = p.source_id
    LEFT JOIN facts f ON f.id = p.fact_id LEFT JOIN stories st ON st.id = f.story_id
    WHERE p.visibility = 'public' AND p.eligible AND (${selectedOnly} = false OR p.selected)
      AND (${includeBackfill} OR NOT p.backfill) AND p.timeline_at >= ${start} AND p.timeline_at < ${end}
      AND (NOT p.selected OR p.visible_after <= ${visibleAt})`;
  // One entry per fact: first-party first, then score.
  const byFact = new Map<string, Candidate>();
  for (const r of rows) {
    const key = r.fact_public_id ?? `a:${r.id}`;
    const c: Candidate = {
      itemId: r.id, factId: r.fact_public_id, storyPublicId: r.story_public_id, title: r.title, summary: r.summary ?? "",
      sourceName: r.source_name, sourceUrl: r.url, sourceId: r.source_id, firstParty: r.first_party, role: roleOf(r.source_kind, r.first_party),
      score: r.score === null ? null : Number(r.score), publishedAt: r.at.toISOString(), category: r.category, factKey: key,
    };
    const prev = byFact.get(key);
    if (!prev || Number(c.firstParty) - Number(prev.firstParty) > 0 || (c.firstParty === prev.firstParty && (c.score ?? 0) > (prev.score ?? 0))) byFact.set(key, c);
  }
  return [...byFact.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/** Facts and items already covered by recent editions are not repeated. */
async function recentlyCovered(kind: "daily", before: string, days = 7): Promise<Set<string>> {
  const rows = await sql<{ content: Record<string, any> }[]>`
    SELECT content FROM reports WHERE kind = ${kind} AND key < ${before} AND key >= ${addDays(before, -days)}`;
  const out = new Set<string>();
  for (const r of rows) {
    for (const s of r.content.sections ?? []) for (const it of s.items ?? []) {
      if (it.itemId) out.add(`a:${it.itemId}`);
      if (it.factId) out.add(it.factId);
      if (it.clusterId) out.add(`c:${it.clusterId}`);
    }
  }
  return out;
}

const LeadSchema = z.object({
  title: z.string().max(120),
  leadParagraph: z.string().max(600),
  highlights: z.array(z.union([z.number(), z.string()])).max(6).catch([]),
});

async function writeLead(kind: string, key: string, entries: ReportEntry[], model: string) {
  if (entries.length === 0) return null;
  const list = entries.slice(0, 30).map((e, i) => `${i + 1}. ${e.title}｜${e.summary.slice(0, 120)}`).join("\n");
  const res = await chatJson({
    model, purpose: "report_lead", subject: `report:${kind}:${key}`, promptVersion: REPORT_VERSION,
    system: promptText("report-daily-lead"),
    user: list, schema: LeadSchema, temperature: 0.3, maxTokens: 800,
  });
  const highlights = res.data.highlights
    .map((h) => entries[Number(h) - 1])
    .filter((e): e is ReportEntry => !!e)
    .map((e) => e.itemId);
  return { lead: { title: res.data.title, leadParagraph: res.data.leadParagraph }, highlights, receiptId: res.receiptId };
}

async function saveReport(kind: "daily" | "weekly" | "monthly", key: string, start: Date, end: Date, content: Record<string, unknown>, reason: string, model: string) {
  await sql.begin(async (tx) => {
    const [existing] = await tx<{ id: number; revision: number; content: unknown; generated_at: Date }[]>`
      SELECT id, revision, content, generated_at FROM reports WHERE kind = ${kind} AND key = ${key} FOR UPDATE`;
    if (existing) {
      await tx`INSERT INTO report_revisions (report_id, revision, content, generated_at, reason)
               VALUES (${existing.id}, ${existing.revision}, ${tx.json(existing.content as never)}, ${existing.generated_at}, ${reason}) ON CONFLICT DO NOTHING`;
      await tx`UPDATE reports SET content = ${tx.json(content as never)}, window_start = ${start}, window_end = ${end}, generated_at = now(),
                 model = ${model}, revision = revision + 1, origin = 'model', updated_at = now() WHERE id = ${existing.id}`;
    } else {
      await tx`INSERT INTO reports (kind, key, window_start, window_end, content, generated_at, model, origin)
               VALUES (${kind}, ${key}, ${start}, ${end}, ${tx.json(content as never)}, now(), ${model}, 'model')`;
    }
  });
}

/** Daily report for Beijing date D covers [D-1 08:00, D 08:00) Beijing time. */
export async function composeDaily(date: string, reason = "scheduled"): Promise<{ key: string; entries: number }> {
  const end = new Date(beijingMidnight(date).getTime() + 8 * 3600 * 1000);
  const start = new Date(end.getTime() - 86400000);
  const covered = await recentlyCovered("daily", date);
  const all = await candidates(start, end);
  const fresh = all.filter((c) => !covered.has(c.factKey) && !covered.has(`a:${c.itemId}`));
  const perSection = new Map<string, Candidate[]>();
  const flashes: Array<{ itemId: string; title: string; sourceName: string; sourceUrl: string; publishedAt: string }> = [];
  for (const c of fresh) {
    const label = SECTION_OF[c.category ?? ""] ?? DEFAULT_SECTION;
    const list = perSection.get(label) ?? [];
    if (list.length < 8) list.push(c);
    else if (flashes.length < 12) flashes.push({ itemId: c.itemId, title: c.title, sourceName: c.sourceName, sourceUrl: c.sourceUrl, publishedAt: c.publishedAt });
    perSection.set(label, list);
  }
  const sections = SECTION_ORDER.filter((l) => perSection.get(l)?.length).map((label) => ({
    label,
    items: perSection.get(label)!.map(({ category: _c, factKey: _f, ...entry }) => entry),
  }));
  const ordered = sections.flatMap((s) => s.items).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const model = await modelFor("report");
  const lead = ordered.length ? await writeLead("daily", date, ordered, model) : null;
  const content = {
    date,
    lead: lead?.lead ?? null,
    highlights: lead?.highlights ?? [],
    sections,
    flashes,
    metrics: {
      totalEvents: ordered.length,
      sourcesCount: new Set(ordered.map((e) => e.sourceId)).size,
      modelsReleased: perSection.get("模型发布/更新")?.length ?? 0,
      firstPartyEvents: ordered.filter((e) => e.firstParty).length,
    },
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    generator: { version: REPORT_VERSION, model, repeatsSuppressed: all.length - fresh.length },
  };
  await saveReport("daily", date, start, end, content, reason, model);
  if (lead) await completeReceipt(sql, lead.receiptId);
  return { key: date, entries: ordered.length };
}

export const PeriodSchema = z.object({
  // A headline is asked for, but a missing or unusable one leaves the issue on its generic name.
  headline: z.string().max(60).catch(""),
  overview: z.string().max(1500),
  themes: z
    // A theme cites at most eight entries; a model that lists more keeps its first eight rather than failing the issue.
    .array(z.object({ heading: z.string().max(60), summary: z.string().max(800), refs: z.array(z.union([z.number(), z.string()])).transform((refs) => refs.slice(0, 8)) }))
    .min(1)
    .transform((themes) => themes.slice(0, 6)),
});

/** The editor's brief for a week or month: its top entries as a numbered list, each with its section. */
export function periodPrompt(kind: "weekly" | "monthly", startDate: string, endDateInclusive: string, top: Candidate[], relatedOnly = false) {
  const list = top.map((e, i) => `${i + 1}. [${SECTION_OF[e.category ?? ""] ?? DEFAULT_SECTION}] ${e.title}｜${e.summary.slice(0, 140)}`).join("\n");
  return {
    system: relatedOnly
      ? promptText("report-period-related", { kindName: kind === "weekly" ? "周报" : "月报" })
      : promptText("report-period", { kindName: kind === "weekly" ? "周报" : "月报", overviewLength: kind === "weekly" ? "150–300" : "200–400" }),
    user: `本期：${startDate} 至 ${endDateInclusive}\n${list}`,
  };
}

async function composePeriod(kind: "weekly" | "monthly", key: string, startDate: string, endDateInclusive: string, reason: string) {
  const start = beijingMidnight(startDate);
  const end = beijingMidnight(addDays(endDateInclusive, 1));
  const visibleAt = new Date();
  // A late archive issue uses the source's original publication date, while only citing items
  // that are public now. It never pretends that a newly discovered item was available then.
  const selected = await candidates(start, end, { includeBackfill: true, visibleAt });
  const relatedOnly = selected.length === 0;
  const all = relatedOnly ? await candidates(start, end, { includeBackfill: true, selectedOnly: false, visibleAt }) : selected;
  const top = all.slice(0, relatedOnly ? 12 : kind === "weekly" ? 40 : 60);
  const retrospective = reason === "historical-backfill" || visibleAt.getTime() - end.getTime() > 2 * 86400_000;
  let themes: Array<{ heading: string; summary: string; storyRefs: ReportEntry[] }> = [];
  let headline = "";
  let overview = "";
  let receiptId: number | null = null;
  const model = top.length ? await modelFor("report") : "editorial-index";
  if (top.length) {
    const res = await chatJson({
      model, purpose: `report_${kind}`, subject: `report:${kind}:${key}`, promptVersion: REPORT_VERSION,
      ...periodPrompt(kind, startDate, endDateInclusive, top, relatedOnly), schema: PeriodSchema, temperature: 0.3, maxTokens: 2500,
    });
    receiptId = res.receiptId;
    headline = relatedOnly ? "同期相关资料回顾" : res.data.headline.trim();
    overview = relatedOnly ? `本期暂无精选，以下为同期公开资料的回顾，并非编辑推荐。${res.data.overview}` : res.data.overview;
    const cited = new Set<string>();
    themes = res.data.themes.map((t) => ({
      heading: relatedOnly ? `待筛选 · ${t.heading}` : t.heading,
      summary: t.summary,
      storyRefs: t.refs.flatMap((r) => {
        const item = top[Number(r) - 1];
        if (!item || cited.has(item.itemId)) return [];
        cited.add(item.itemId);
        const { category: _c, factKey: _f, ...entry } = item;
        return [entry];
      }),
    })).filter((t) => t.storyRefs.length > 0);
    if (!themes.length) themes = [{
      heading: relatedOnly ? "同期资料 · 待筛选" : "本期精选",
      summary: relatedOnly ? "按原始发表日期列出的相关资料，尚未作为精选推荐，具体结论请核对原文。" : "按原始发表日期列出的精选资料，具体结论请核对原文。",
      storyRefs: top.map(({ category: _c, factKey: _f, ...entry }) => entry),
    }];
  } else if (relatedOnly) {
    headline = "本期资料覆盖说明";
    overview = "本期在现有信源中没有可展示的相关资料。此处只记录覆盖空缺，不推断当时没有水利科研进展。";
  }
  const content = {
    kind,
    title: kind === "weekly" ? `${SITE.name} 周报 · ${key}` : `${SITE.name} 月报 · ${key}`,
    ...(kind === "weekly" ? { isoLabel: key } : { monthLabel: key }),
    periodStart: startDate,
    periodEnd: endDateInclusive,
    ...(headline ? { headline } : {}),
    overview,
    themes,
    storyOrder: top.map((e) => e.itemId),
    metrics: { totalStories: new Set(themes.flatMap((t) => t.storyRefs.map((item) => item.itemId))).size, selectedCount: selected.length, relatedCount: relatedOnly ? top.length : 0 },
    coverage: { retrospective, relatedOnly },
    generator: { version: REPORT_VERSION, model },
  };
  await saveReport(kind, key, start, end, content, reason, model);
  if (receiptId) await completeReceipt(sql, receiptId);
  return { key, entries: top.length };
}

export async function composeWeekly(label: string, reason = "scheduled") {
  const range = isoWeekRange(label);
  if (!range) throw new Error(`bad week label ${label}`);
  return composePeriod("weekly", label, range.start, range.end, reason);
}

export async function composeMonthly(label: string, reason = "scheduled") {
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m) throw new Error(`bad month label ${label}`);
  const start = `${label}-01`;
  const next = Number(m[2]) === 12 ? `${Number(m[1]) + 1}-01-01` : `${m[1]}-${String(Number(m[2]) + 1).padStart(2, "0")}-01`;
  return composePeriod("monthly", label, start, addDays(next, -1), reason);
}

/**
 * Catch-up for the last complete week and month. Historical daily reports stay readable, but new
 * daily issues are not generated for this site.
 */
export async function catchUpReports(now = new Date()): Promise<{ generated: string[] }> {
  const generated: string[] = [];
  const today = beijingDate(now);
  const bjHour = Number(new Date(now.getTime() + 8 * 3600000).toISOString().slice(11, 13));
  // Last complete ISO week (Monday 10:00 onwards).
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const lastWeek = isoWeekLabel(addDays(today, -dow - 7));
  const weekDue = dow > 0 || bjHour >= 10;
  if (weekDue) {
    const [w] = await sql`SELECT 1 FROM reports WHERE kind = 'weekly' AND key = ${lastWeek}`;
    if (!w) {
      await composeWeekly(lastWeek, "catch-up");
      generated.push(`weekly:${lastWeek}`);
    }
  }
  // Last complete month (1st 10:30 onwards).
  const [y, mo, dd] = today.split("-").map(Number) as [number, number, number];
  const prevMonth = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const monthDue = dd > 1 || bjHour > 10 || (bjHour === 10 && Number(new Date(now.getTime() + 8 * 3600000).toISOString().slice(14, 16)) >= 30);
  if (monthDue) {
    const [m] = await sql`SELECT 1 FROM reports WHERE kind = 'monthly' AND key = ${prevMonth}`;
    if (!m) {
      await composeMonthly(prevMonth, "catch-up");
      generated.push(`monthly:${prevMonth}`);
    }
  }
  return { generated };
}
