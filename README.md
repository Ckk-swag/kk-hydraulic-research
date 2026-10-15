# 未来水利交叉信息情报站

面向水利科研，以及水利与 AI、数字孪生和水域机器人的交叉研究，聚合公开资料、生成中文阅读线索，并保留原始来源。

本仓库用于分享网站源码。运行中的网站由独立服务器维护：服务器持续采集、筛选并更新内容，GitHub 仓库本身不运行采集任务。域名 `kk-hydraulic-research.cn` 将在备案和公网部署完成后启用；当前本机预览地址不能供其他人访问。

## 功能

- 公开信源采集、去重、模型辅助分类与筛选。
- 精选与全部动态、主题索引、搜索和本地收藏。
- 水利 × AI、数字孪生与智能调度、水利机器人、无人船与自主观测四个交叉专题。
- 周报与月报自动生成；停发日报，保留历史归档的读取能力。
- 支持历史资料按原始发表日期回溯归档；相关资料与精选分别标注。
- RSS、公开 API 与只读 MCP；API/Agent 搜索支持三个日历月的窗口，站内搜索覆盖所有已收录资料。
- 管理后台、任务状态、预算与匿名汇总统计；运行页每小时自动刷新，也可手动刷新。

网站内容是阅读索引。标题、摘要和主题归并可能有误，研究结论和工程参数请核对原文。

## 运行

需要 Docker 与 Docker Compose。首次运行：

```bash
git clone https://github.com/Ckk-swag/kk-hydraulic-research.git
cd kk-hydraulic-research
cp .env.example .env
```

在自己的 `.env` 中配置模型 API、随机管理员密码、会话与图片签名密钥、数据库密码。建议使用随机长密码。然后启动：

```bash
docker compose up -d --build
```

访问 `http://127.0.0.1:3000`。后台地址为 `/admin`。初次启动会迁移数据库并导入信源配置；内容随采集与筛选任务逐步出现。

详细说明见 [部署文档](docs/deploy.md)、[信源文档](docs/sources.md)、[行业配置](docs/customize.md) 和 [筛选机制](docs/selection.md)。

## 自动更新如何工作

`worker` 持续运行，每分钟检查到期信源，各信源按自己的采集间隔抓取。周报在北京时间每周一 10:00、月报在每月 1 日 10:30 生成，并有漏跑补偿。读者访问页面不会触发模型调用。

只要服务器、数据库与模型服务正常，分享同一个网站链接即可看到后续内容更新。发布新的程序功能需要重新部署代码；推送 GitHub 不会自动修改你的服务器。

## 仓库内容与配置

```text
industry/       站点文案、信源、主题、提示词、筛选标准和品牌素材
apps/web/       网站与管理后台
apps/api/       HTTP API、RSS、MCP 与后台接口
apps/worker/    采集、筛选、归并和定时报告任务
packages/       合同类型与共享后端模块
database/       数据库迁移与公共配置种子
```

仓库不包含正在运行的网站数据库、采集结果、服务器配置、真实密码、API 密钥、Zotero 文库、Obsidian 笔记或论文 PDF。`industry/pages/` 中的联系邮箱为占位值，自行部署前请按实际运营情况修改使用规则与隐私说明。

`scripts/backfill-*.ts` 是有明确时间范围的历史整理工具，运行前应检查日期和信源。带 `--apply` 的导入可能触发付费模型处理，请先预览并设置预算。

## 检查

Node.js 24，PostgreSQL 17：

```bash
npm ci
npm run typecheck
npm run build -w @aihot/web
node --test apps/web/tests/*.test.ts
```

后端测试会写数据库，只能在名称以 `_test` 或 `_ci` 结尾的独立测试库运行。参考 [GitHub Actions](.github/workflows/check.yml)。

## 来源与许可

本项目在 [KKKKhazix/AIHOT](https://github.com/KKKKhazix/AIHOT) 框架基础上改造，保留原作者版权声明、[MIT License](LICENSE) 和 [NOTICE](NOTICE)。本仓库展示自己的水利站名称与品牌。

第三方字体与标识遵循各自许可；资料版权归原始来源所有。默认只展示摘要与原文链接。
