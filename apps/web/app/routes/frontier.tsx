import { SITE } from "@aihot/industry/site";
import type { FeedItemSummary } from "@aihot/contracts/site";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/frontier";
import { apiGet } from "../lib/api.server";
import { pageMeta } from "../lib/seo";

interface Topic {
  slug: string;
  name: string;
  definition: string;
  group: string;
  total: number;
  available: number;
}

const SECTIONS = [
  { title: "水利 × AI", note: "关注能对照数据、物理基准和误差指标的 AI 方法。", slugs: ["water-ai", "water-digital-twin"], lead: "water-ai" },
  { title: "水利 × 机器人", note: "关注真实水域测量、无人船、水下平台和水工设施作业。", slugs: ["water-robotics", "autonomous-water-observation"], lead: "water-robotics" },
] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const { topics } = await apiGet<{ topics: Topic[] }>("/api/site/topics", { signal: request.signal });
  const featured = await Promise.all(SECTIONS.map(async (section) => {
    const page = await apiGet<{ items: FeedItemSummary[] }>(`/api/site/topics/${section.lead}`, { signal: request.signal }).catch(() => ({ items: [] }));
    return { slug: section.lead, items: page.items.slice(0, 3) };
  }));
  return { topics: topics.filter((topic) => topic.group === "cross"), featured };
}

export const meta: Route.MetaFunction = () => pageMeta({
  title: "交叉前沿",
  description: `${SITE.name} 的水利与 AI、数字孪生和水域机器人交叉专题。`,
  path: "/frontier",
});

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=60" };
}

export default function Frontier({ loaderData }: Route.ComponentProps) {
  const topicBySlug = new Map(loaderData.topics.map((topic) => [topic.slug, topic]));
  const featuredBySlug = new Map(loaderData.featured.map((entry) => [entry.slug, entry.items]));
  return (
    <div className="pb-12">
      <header className="pb-4 pt-5 lg:pt-1">
        <div className="text-[11px] font-bold tracking-[0.2em] text-accent">WATER × AI × ROBOTICS</div>
        <h1 className="mt-2 text-[28px] font-bold tracking-tight text-ink">交叉前沿</h1>
        <p className="mt-2 max-w-[52em] text-[14px] leading-7 text-ink-3">把 AI 和机器人放回具体的水文、水动力、水环境问题中看。每条线索保留原始来源；有精选与待筛选资料分别标注。</p>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.lead} className="mt-8" aria-labelledby={`frontier-${section.lead}`}>
          <div className="mb-4">
            <h2 id={`frontier-${section.lead}`} className="text-[20px] font-semibold text-ink">{section.title}</h2>
            <p className="mt-1 text-[13px] text-ink-3">{section.note}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.slugs.map((slug) => {
              const topic = topicBySlug.get(slug);
              if (!topic) return null;
              return (
                <Link key={slug} to={`/topics/${slug}`} className="card card-hover flex min-h-[142px] flex-col p-5">
                  <span className="text-[17px] font-semibold text-ink">{topic.name}</span>
                  <span className="mt-2 flex-1 text-[13px] leading-6 text-ink-3">{topic.definition}</span>
                  <span className="mt-3 text-[12px] font-medium text-accent">{topic.total > 0 ? `${topic.total} 条精选` : topic.available > 0 ? `${topic.available} 条相关资料 · 待筛选` : "信源接入中"} →</span>
                </Link>
              );
            })}
          </div>
          {(featuredBySlug.get(section.lead) ?? []).length > 0 && (
            <div className="mt-4 rounded-panel border border-line bg-surface px-5 py-4">
              <h3 className="text-[13px] font-semibold text-ink-2">近期线索</h3>
              <ul className="mt-2 divide-y divide-line-soft">
                {featuredBySlug.get(section.lead)!.map((item) => (
                  <li key={item.id} className="py-3">
                    <Link to={`/items/${item.id}`} className="text-[14px] font-medium leading-6 text-ink hover:text-accent">{item.title}</Link>
                    <div className="mt-1 text-[11.5px] text-ink-4">{item.source.name} · {item.selected ? "精选" : "待筛选"}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
