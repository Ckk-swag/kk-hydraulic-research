// 站点身份与公开文案。域名、备案号和联系地址在上线前填写。
export const SITE = {
  name: "未来水利交叉信息情报站",
  wordmarkLines: ["未来水利交叉", "信息情报站"],
  subject: "水利",
  homeTitle: "未来水利交叉信息情报站 — 水利、AI 与机器人交叉动态",
  description: "聚合水利科研、AI 方法与水域机器人交叉领域的公开资料，兼顾河口潮汐、河涌模拟与泥沙研究，提供可追溯的中文摘要和原文链接。",
  tagline: "看见水利、AI 与机器人的交汇",
  locale: "zh-CN",
  defaultUrl: "http://localhost:3000",
  mcpPrefix: "kaikaiwater",
  contactEmail: null as string | null,
  footerNote: "聚合公开资料 · 重要结论请核对原文",
  icp: null as string | null,
  organization: {
    name: "未来水利交叉信息情报站",
    founder: null as null | { name: string; url?: string; description?: string },
  },
  crawlerName: "KaikaiWaterResearchBot",
} as const;

export const ABOUT = {
  kicker: `关于 ${SITE.name}`,
  headline: ["水利资料每天都在更新，", "先找到与你有关的变化。"] as [string, string],
  lead: `${SITE.name} 汇集 {sources} 个公开信源，关注河口潮汐、水动力模拟、AI 水文方法与水域机器人；按资料内容筛选、归并，发布周报与月报。`,
  steps: {
    collect: "追踪期刊订阅、研究机构与官方公开页面；每条资料保留原文链接和发布时间。",
    store: "把报道同一项研究、工程或政策的资料归在一起，避免重复刷屏。",
    select: "依据研究相关性、方法增量与证据强度筛选；标题和摘要只写原文支持的事实。",
    publish: "提供周报和月报，也可通过 RSS、API 与 MCP 读取动态。",
  },
  maker: null as null | {
    name: string;
    greeting: string[];
    avatarSourceId?: string | null;
    wechat?: { title: string; note: string };
    feishu?: { title: string; note: string };
  },
  copyright: `${SITE.name} 提供公开资料的摘要和阅读索引，原文版权归各来源所有。若需更正、下架或调整展示方式，请通过`,
} as const;

export function withSubject(noun: string): string {
  return /[A-Za-z0-9]$/.test(SITE.subject) ? `${SITE.subject} ${noun}` : `${SITE.subject}${noun}`;
}
