# 部署

## 配置与启动

需要 Docker 与 Docker Compose，建议至少 2 核、4 GB 内存。

```bash
git clone https://github.com/Ckk-swag/kk-hydraulic-research.git
cd kk-hydraulic-research
cp .env.example .env
```

只在自己的 `.env` 中填写 `LLM_API_KEY`、`ADMIN_PASSWORD`、`SESSION_SECRET`、`IMG_PROXY_SIGN_SECRET` 和 `POSTGRES_PASSWORD`。管理员密码建议随机且足够长；签名密钥可用 `openssl rand -hex 32` 生成。不要将 `.env` 或部署备份提交到 GitHub。

```bash
docker compose up -d --build
```

默认访问 `http://127.0.0.1:3000`，后台为 `/admin`。Compose 启动 PostgreSQL、迁移与种子任务、API、网页及持续运行的 worker。新部署的数据库没有原站的文章和报告；采集后会逐步积累内容。

模型处理受回执与预算限制。调试时设置 `COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`，防止意外产生外部调用。

## 域名与 HTTPS

中国大陆服务器须按接入商要求完成 ICP 备案。将获批域名解析到自己的服务器后，在 `.env` 设置实际值：

```dotenv
SITE_URL=https://example.com
SITE_DOMAIN=example.com
PUBLIC_BIND_IP=10.0.0.5
PORT=127.0.0.1:3000
ADMIN_PRIVATE_HTTP_HOSTS=127.0.0.1,localhost
TRUST_PROXY=true
```

`PUBLIC_BIND_IP` 是接收公网流量的云服务器网卡地址，示例值需要替换。云安全组需允许 Web 的 TCP 80/443。Caddy 默认只绑定本机；显式设置公网网卡地址后才对外监听。

```bash
docker compose --profile https up -d --build
```

Caddy 自动申请与续期证书。其域名入口对 `/admin`、`/api/admin`、`/api/auth` 和 `/api/ingest` 返回 404；通过 SSH 转发或自己的私有网络访问后台。使用 Tailscale 时可将 `PORT` 绑定到自己的 Tailscale 地址，并将该主机名加入 `ADMIN_PRIVATE_HTTP_HOSTS`，请勿公开暴露弱密码后台。

将真实备案号填写到 `industry/site.ts` 的 `icp`。自行部署前修改并确认 `industry/pages/terms.md` 和 `industry/pages/privacy.md` 的运营主体、联系邮箱、日志与数据处理内容。

## 自动采集与报告

worker 每分钟检查到期信源，各信源按配置间隔采集。周报每周一北京时间 10:00 生成，月报每月 1 日 10:30 生成；日报已停发。更改后台运行页面的刷新频率不影响采集。

服务器应保持运行；模型服务不可用、预算熔断或信源访问失败时，后台运行记录会显示原因。

## 更新与日志

```bash
git pull
docker compose up -d --build
docker compose ps
docker compose logs --tail 80 api worker web
```

代码推送 GitHub 后仍需自行部署，不会自动更新服务器。文章与周报/月报由服务器持续写入数据库，不需要每次内容变化都推送代码。

## 备份与测试

数据库与文件存放在 Docker 卷中。可配置 `.env.example` 中的对象存储备份选项，并定期验证恢复流程。不要将包含数据库或密钥的备份上传公开仓库。

后端测试只允许使用 `_test` 或 `_ci` 结尾的独立数据库；迁移后运行 `npm test`。构建完成且服务启动后，可运行 `node scripts/smoke.ts --base http://127.0.0.1:3000` 检查公开页面与接口。
