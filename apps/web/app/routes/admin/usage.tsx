import { SITE } from "@aihot/industry/site";
import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/usage";
import { adminGet } from "../../lib/admin.server";
import { AdminPage, Card, DataTable } from "../../features/admin/ui";

interface Overview {
  days: number;
  totals: { page_views: number; active_browsers: number; searches: number; favorite_adds: number; favorite_removes: number; exports: number };
  daily: Array<{ day: string; page_views: number; active_browsers: number; searches: number; favorite_adds: number; exports: number }>;
  terms: Array<{ term: string; uses: number }>;
}

export async function loader({ request }: Route.LoaderArgs) {
  const days = Number(new URL(request.url).searchParams.get("days")) || 7;
  return adminGet<Overview>(request, `/api/admin/usage?days=${days}`);
}

export const meta: Route.MetaFunction = () => [{ title: `使用统计 · ${SITE.name} 后台` }];

export default function Usage({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const days = Number(params.get("days")) || loaderData.days;
  const cards = [
    ["访问量", loaderData.totals.page_views],
    ["活跃浏览器估算", loaderData.totals.active_browsers],
    ["搜索", loaderData.totals.searches],
    ["新增收藏", loaderData.totals.favorite_adds],
    ["取消收藏", loaderData.totals.favorite_removes],
    ["导出", loaderData.totals.exports],
  ] as const;
  return (
    <AdminPage title="使用统计" subtitle="匿名汇总。活跃数按浏览器本地随机标识估算，同一人使用多个浏览器会重复计数。">
      <div className="mb-5 flex flex-wrap gap-2">
        {[1, 7, 30, 90].map((n) => <Link key={n} to={`?days=${n}`} className={`rounded-control px-3 py-1.5 text-[13px] ${days === n ? "bg-accent text-white" : "bg-surface text-ink-2 ring-1 ring-line"}`}>近 {n} 天</Link>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => <Card key={label}><div className="text-[12px] text-ink-3">{label}</div><div className="num mt-2 text-[28px] font-semibold text-ink">{value}</div></Card>)}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-[16px] font-semibold">每日趋势</h2>
          <DataTable rows={loaderData.daily} rowKey={(r) => r.day} empty="暂无访问记录" columns={[
            { key: "day", label: "日期", render: (r) => r.day },
            { key: "views", label: "访问", render: (r) => r.page_views },
            { key: "active", label: "浏览器", render: (r) => r.active_browsers },
            { key: "search", label: "搜索", render: (r) => r.searches },
            { key: "favorite", label: "收藏", render: (r) => r.favorite_adds },
            { key: "export", label: "导出", render: (r) => r.exports },
          ]} />
        </Card>
        <Card>
          <h2 className="mb-3 text-[16px] font-semibold">常用搜索词</h2>
          <DataTable rows={loaderData.terms} rowKey={(r) => r.term} empty="暂无搜索记录" columns={[
            { key: "term", label: "搜索词", render: (r) => <span className="break-all">{r.term}</span> },
            { key: "uses", label: "次数", render: (r) => r.uses },
          ]} />
        </Card>
      </div>
      <p className="mt-4 text-[12px] text-ink-4">仅统计在浏览器中实际打开的页面；屏蔽脚本或清除本站数据会影响估算。记录保留 90 天。</p>
    </AdminPage>
  );
}
