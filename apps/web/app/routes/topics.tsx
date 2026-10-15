import { Link, useLoaderData } from "react-router";
import { apiGet } from "../lib/api.server";
import { pageMeta } from "../lib/seo";

interface TopicSummary {
  slug: string;
  name: string;
  group: "company" | "field" | "cross" | "genre";
  definition: string;
  total: number;
  available: number;
  recent: number;
  indexable: boolean;
  latestAt: string | null;
}

export async function loader({ request }: { request: Request }) {
  return apiGet<{ topics: TopicSummary[] }>("/api/site/topics", { signal: request.signal });
}

export function meta() {
  return pageMeta({ title: "主题", description: "按机构、研究方向与资料类型浏览河口潮汐、河涌模拟、泥沙和水利科研动态。", path: "/topics", image: "/og/pages/topics.png" });
}

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=60" };
}

const GROUPS = [
  { key: "company", name: "机构与来源", blurb: "追踪发布研究、数据和政策的机构" },
  { key: "field", name: "研究方向", blurb: "按河口、河涌、泥沙与数值模拟查找线索" },
  { key: "cross", name: "交叉前沿", blurb: "水利与 AI、数字孪生及水域机器人" },
  { key: "genre", name: "资料类型", blurb: "区分论文、数据、软件、工程与规范" },
] as const;

export default function TopicsPage() {
  const { topics } = useLoaderData<typeof loader>();
  const visibleTopics = topics.filter((topic) => topic.available > 0);
  return (
    <div className="pb-10">
      <header className="pb-2 pt-5 lg:pt-1">
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">按主题看水利科研</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
          按机构、研究方向和资料类型浏览 <span className="num">{visibleTopics.length}</span> 个已有内容的主题，持续汇集近期焦点与精选。
        </p>
      </header>
      {GROUPS.filter((g) => visibleTopics.some((topic) => topic.group === g.key)).map((g) => (
        <section key={g.key} aria-labelledby={`topics-${g.key}`} className="pt-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 id={`topics-${g.key}`} className="text-[15px] font-bold text-ink">
              {g.name}
            </h2>
            <p className="text-[12px] text-ink-4">{g.blurb}</p>
          </div>
          <ul className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleTopics
              .filter((t) => t.group === g.key)
              .map((t) => (
                <li key={t.slug}>
                  <Link
                    to={`/topics/${t.slug}`}
                    prefetch="intent"
                    aria-label={`查看${t.name}${t.total > 0 ? "精选文章" : "待筛选的相关资料"}`}
                    className="card card-hover group flex h-full flex-col px-5 py-[18px]"
                  >
                    <span className="text-[15px] font-bold text-ink transition-colors group-hover:text-accent">{t.name}</span>
                    <span className="mt-1.5 line-clamp-2 flex-1 text-[12.5px] leading-[1.7] text-ink-3">{t.definition}</span>
                    <span className="mono mt-3 text-[11.5px] text-accent">
                      查看 {t.total > 0 ? `${t.total} 条精选` : `${t.available} 条相关资料 · 待筛选`} <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
