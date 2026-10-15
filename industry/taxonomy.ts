// 面向河口潮汐、城市河涌与泥沙数值模拟的分类和受控词表。
// key、slug 与实体 id 会进入公开网址；上线后应保持稳定。
export const CATEGORIES = [
  { key: "paper", label: "论文", section: "研究论文", guide: "有明确研究问题、方法、结果与出处的论文、预印本、技术报告或综述" },
  { key: "data", label: "数据", section: "数据与监测", guide: "水位、流量、流速、泥沙、地形、遥感等观测数据或公开数据集，以及有数据支持的监测结果" },
  { key: "model", label: "模型", section: "模型与软件", guide: "水动力、泥沙、水质或流域模型的版本、源码、工具与可复用计算流程" },
  { key: "project", label: "工程", section: "工程与案例", guide: "河口整治、河涌治理、防洪排涝、水生态修复等工程进展与有可迁移方法的案例" },
  { key: "policy", label: "政策", section: "政策与标准", guide: "正式发布的水利政策、规范、标准、规划、管理措施与监管信息" },
  { key: "method", label: "方法", section: "方法与实践", guide: "网格、边界条件、率定验证、不确定性、观测分析与模型诊断的教程或实践" },
  { key: "industry", label: "动态", section: "其他动态", guide: "与水利科研有关但不属于上述类别的机构活动、观点或行业变化" },
] as const;

export const ITEM_TYPES = [
  "research_paper", "dataset_release", "software_release", "field_observation",
  "engineering_project", "policy_update", "tutorial_explainer",
] as const;

export const CATEGORY_TAGS = [
  "论文/研究", "数据/监测", "模型/软件", "工程/案例", "政策/标准", "方法/实践", "行业动态", "其他",
] as const;

export const TOPIC_TAGS = [
  "河口潮汐", "城市河涌", "泥沙输运", "水动力模拟", "水质与生态", "洪潮与内涝",
  "流域水文", "观测与遥感", "网格与地形", "率定与验证", "数据同化", "AI与水利",
  "水利数字孪生", "水利机器人", "自主水域观测",
] as const;

export const ENTITY_TAGS = [
  "水利部", "珠江委", "广东省水利厅", "中国水科院", "南京水科院", "USGS", "Deltares", "HESS", "Nature Water",
] as const;

export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  论文: "论文/研究", 研究: "论文/研究", paper: "论文/研究", preprint: "论文/研究",
  数据: "数据/监测", 监测: "数据/监测", 观测: "数据/监测", dataset: "数据/监测",
  模型: "模型/软件", 软件: "模型/软件", 开源: "模型/软件", 代码: "模型/软件",
  工程: "工程/案例", 案例: "工程/案例", 治理: "工程/案例",
  政策: "政策/标准", 标准: "政策/标准", 规范: "政策/标准", 规划: "政策/标准",
  方法: "方法/实践", 教程: "方法/实践", 实践: "方法/实践", 技术: "方法/实践",
  潮汐: "河口潮汐", 河口: "河口潮汐", 河涌: "城市河涌", 泥沙: "泥沙输运",
  水动力: "水动力模拟", 水质: "水质与生态", 内涝: "洪潮与内涝", 遥感: "观测与遥感",
  率定: "率定与验证", 验证: "率定与验证", 网格: "网格与地形", 地形: "网格与地形",
  数字孪生: "水利数字孪生", 水利AI: "AI与水利", 智能水利: "AI与水利",
  水下机器人: "水利机器人", 水面机器人: "水利机器人", 无人船: "自主水域观测", 水下自主观测: "自主水域观测",
};

export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  research_paper: "论文/研究",
  dataset_release: "数据/监测",
  software_release: "模型/软件",
  field_observation: "数据/监测",
  engineering_project: "工程/案例",
  policy_update: "政策/标准",
  tutorial_explainer: "方法/实践",
};

export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  mwr: { name: "水利部", displayTag: "水利部", aliases: ["中华人民共和国水利部", "水利部", "MWR"] },
  pearl: { name: "水利部珠江水利委员会", displayTag: "珠江委", aliases: ["珠江水利委员会", "珠江委", "珠江水利网"] },
  guangdong: { name: "广东省水利厅", displayTag: "广东省水利厅", aliases: ["广东省水利厅", "广东水利"] },
  iwhr: { name: "中国水利水电科学研究院", displayTag: "中国水科院", aliases: ["中国水科院", "中国水利水电科学研究院", "IWHR"] },
  nhri: { name: "南京水利科学研究院", displayTag: "南京水科院", aliases: ["南京水利科学研究院", "南京水科院", "NHRI"] },
  usgs: { name: "美国地质调查局", displayTag: "USGS", aliases: ["USGS", "U.S. Geological Survey"] },
  deltares: { name: "Deltares", displayTag: "Deltares", aliases: ["Deltares"] },
  hess: { name: "Hydrology and Earth System Sciences", displayTag: "HESS", aliases: ["HESS", "Hydrology and Earth System Sciences"] },
  "nature-water": { name: "Nature Water", displayTag: "Nature Water", aliases: ["Nature Water"] },
};

// 原文或来源须支持机构身份，防止标题把研究误归给另一机构。
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "mwr", name: "水利部", patterns: [/水利部|Ministry of Water Resources of China/i] },
  { id: "pearl", name: "珠江委", patterns: [/珠江水利委员会|珠江委|Pearl River Water Resources Commission/i] },
  { id: "guangdong", name: "广东省水利厅", patterns: [/广东省水利厅/i] },
  { id: "iwhr", name: "中国水科院", patterns: [/中国水利水电科学研究院|中国水科院|\bIWHR\b/i] },
  { id: "nhri", name: "南京水科院", patterns: [/南京水利科学研究院|南京水科院|\bNHRI\b/i] },
  { id: "usgs", name: "USGS", patterns: [/\bUSGS\b|U\.S\. Geological Survey/i] },
  { id: "deltares", name: "Deltares", patterns: [/Deltares/i] },
];

export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "mwr", domains: ["mwr.gov.cn"] },
  { entityId: "pearl", domains: ["pearlwater.gov.cn"] },
  { entityId: "guangdong", domains: ["slt.gd.gov.cn"] },
  { entityId: "iwhr", domains: ["iwhr.com"] },
  { entityId: "nhri", domains: ["nhri.cn"] },
  { entityId: "usgs", domains: ["usgs.gov"] },
  { entityId: "deltares", domains: ["deltares.nl"] },
  { entityId: "hess", domains: ["hess.copernicus.org"] },
  { entityId: "nature-water", domains: ["nature.com"] },
];

export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
