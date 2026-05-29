<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

- **Edge entry is `src/proxy.ts`** (exported `proxy` + `config.matcher`), not `middleware.ts`. Do not reintroduce `middleware.ts` unless you have confirmed the installed Next version still supports your use case.
- Prefer project-local docs under `node_modules/next/dist/docs/` over generic Next 13/14 knowledge (App Router, `headers()`, custom server constraints, etc.).
<!-- END:nextjs-agent-rules -->

# ai-workshop-sso — Agent guide

统一身份认证服务（OIDC Provider），部署在 `auth.aiprd.club`，为 AI 工具产品提供 SSO。本仓库是**独立认证域**，不直连任何业务数据库。

**规格（权威）**：`~/Documents/LiCode/ai-course-copilot/docs/ai-workshop-sso-spec.md`（改协议、表结构、安全条款前先读对应章节）。

**人类可读概览**：根目录 `README.md`（本地开发、Docker 部署、里程碑进度）。

---

## 架构（改代码前必须理解）

```
Browser
   │
   ▼
src/server.ts  (custom Node HTTP server, 入口: pnpm dev / pnpm start)
   ├─ /oidc/* 以及 /.well-known/*  →  oidc-provider (Koa)，经 URL 重写挂载
   └─ 其余路径                      →  Next.js App Router (getRequestHandler)
         └─ src/proxy.ts (Edge)    →  内部 API 鉴权、敏感 query 剥离
```

| 区域 | 运行时 | 说明 |
|------|--------|------|
| `src/server.ts` | Node | **唯一进程入口**；`dotenv/config` 必须在最顶部 import（Prisma adapter 在模块加载时读 `DATABASE_URL`） |
| `src/lib/oidc-provider.ts` | Node | oidc-provider 单例、PrismaAdapter、JWKS、grant 钩子、interactionPolicy |
| `src/app/**` | Next | 登录/注册 UI、`/api/*` 业务路由 |
| `src/proxy.ts` | Edge | `/api/internal/*` 校验 `X-Internal-Token`；认证页 URL 上的密码等 query 重定向剥离 |
| `deploy/Caddyfile` | 生产 | HTTPS、HSTS；与 `next.config.ts` 的 CSP 分工（见下） |

**硬性约束**

1. **不要**在 `next.config.ts` 启用 `output: "standalone"` — 与 custom server 不兼容（见 `next.config.ts` 注释）。
2. **不要**改动 `server.ts` 里 `/oidc` 前缀剥离与 `originalUrl` 逻辑，除非你对照 `oidc-provider` 的 `urlFor()` 行为做过验证；否则 Discovery、redirect、issuer 会错。
3. OIDC 协议端点由 oidc-provider 提供；**不要**在 Next 里重复实现 token/userinfo，除非规格明确要求且已与现有 `/oidc/*` 路径对齐。
4. 登录/OIDC 续流用 `src/lib/interaction.ts` 的 `finishInteraction` / `postAuthRedirect`；`finishInteraction` 返回 `null` 是正常陈旧 interaction，**必须**友好重定向，不要抛 500。
5. `/oidc/*` **不经过** Next `headers()`；浏览器可见的安全头主要靠 `next.config.ts`（Next 路由）+ Caddy（生产）。

---

## 技术栈与约定

| 层 | 选型 |
|----|------|
| Web | Next.js 16 App Router, React 19, Tailwind v4, TypeScript |
| 协议 | `oidc-provider` + PrismaAdapter (`src/lib/oidc-adapter.ts`) |
| 数据 | Prisma 7 + PostgreSQL；Redis（`ioredis`）限频 |
| 密码 | argon2id（`src/lib/password.ts`，含 `verifyAndUpgrade`） |
| JWT/JWKS | `jose` + DB 加密私钥（`src/lib/jwks.ts`, `src/lib/crypto.ts`） |
| 校验 | **zod** — API body 与 `src/lib/env.ts` 环境变量 |
| 邮件 | `src/lib/email.ts` 抽象；Phase 0 默认 `EMAIL_PROVIDER=console` |
| 包管理 | **pnpm**（`packageManager` 已锁定） |

**代码风格**

- 路径别名：`@/` → `src/`（与 `tsconfig` / Vitest 一致）。
- 读配置：**始终**通过 `env()`（`src/lib/env.ts`），不要在业务代码里散落 `process.env`。
- 数据库：**`prisma` 单例**（`src/lib/db.ts`）；OIDC 临时态走 adapter，不要为 provider 再建一套表访问层。
- 安全敏感操作：写 **`audit()`**（`src/lib/audit.ts`）；登录/注册走 **`rate-limit.ts`**。
- API 路由：入参 `z.safeParse`；支持 JSON 与 `formData` 时参考 `src/app/api/login/route.ts`。
- 新增环境变量：同时更新 `.env.example` 与 `EnvSchema`。

---

## 安全（不可妥协）

- 生产密钥：`COOKIE_SECRET`、`INTERNAL_API_TOKEN`、`JWKS_ENCRYPTION_KEY` 须 `openssl rand -hex 32` 生成；勿提交 `.env`。
- 内部 API：仅 `Authorization` 不够 — Edge 层要求 **`X-Internal-Token`**（见 `src/proxy.ts`）。
- **永不**直连业务库；跨服务只走 HTTPS + OIDC / 内部 API。
- CSP：**不要**给 `form-action` 收紧到仅 `'self'` — OIDC 303 链会跨 RP origin；最终跳转由 `redirect_uri` 白名单保证（见 `next.config.ts` 注释）。
- 开发环境：**不要**在 `NODE_ENV=development` 下启用 `upgrade-insecure-requests` / HSTS（已按 `isProd` 分支）；否则会破坏 `http://localhost` 上的 OIDC 303 链。
- 弱密码：注册/改密路径应尊重 `SKIP_HIBP_CHECK` 与 HIBP 逻辑（`src/lib/password.ts`）。
- 修改 cookie、token TTL、rotation、SSO cookie 域时，对照规格 Section 10 与 README「安全提醒」。

---

## 测试

```bash
pnpm test          # vitest run，tests/unit/*
pnpm test:watch
pnpm lint
pnpm build         # prisma generate && next build（与 CI 一致）
```

- 单元测试放在 `tests/unit/`，**不得依赖真实数据库**（见 `vitest.config.ts` 注释）。
- 改 `crypto`、`password`、`oidc-adapter`、`sso-check`、`sensitive-query-params` 等纯逻辑时，应补或更新对应 unit test。
- OIDC 端到端：`pnpm demo`（`scripts/demo-oidc-flow.ts`）；改 interaction / cookie / redirect 后建议本地跑一遍。

---

## 提交与推送（CI 门禁）

**硬性要求**：任何 commit / push 之前，必须在本地跑通 CI 同款检查；未通过则**不得**提交并推送代码。

```bash
pnpm lint && pnpm build
```

CI 流水线（`.github/workflows/deploy.yml` 的 `ci` job）仅执行上述两步；本地失败即会在 `main` 推送时阻断部署。建议一并跑 `pnpm test`，避免逻辑回归。

- 修复全部 lint / 类型 / 构建错误后再 `git commit`。
- 不要依赖「推到远端再看 CI 结果」；不要把已知会红的变更推上 `main`。

---

## 常用命令

```bash
cp .env.example .env && docker compose up -d    # Postgres；Redis 用本机 6379
pnpm prisma migrate dev
pnpm seed:clients
pnpm dev                                         # http://localhost:3000
pnpm rotate:keys
```

生产迁移：`pnpm prisma migrate deploy`（在容器/部署环境内执行，见 README）。

---

## 目录速查

| 路径 | 职责 |
|------|------|
| `src/server.ts` | Custom server，OIDC 与 Next 同进程 |
| `src/proxy.ts` | Edge proxy（内部 API + query 清理） |
| `src/lib/oidc-provider.ts` | Provider 配置与生命周期 |
| `src/lib/interaction.ts` | 登录后完成 OIDC interaction |
| `src/lib/cookies.ts` | SSO cookie（`aiprd_sso`） |
| `src/app/api/login`, `register`, `logout` | 认证 API |
| `src/app/api/internal/*` | 运维/种子/密钥轮换（M3） |
| `prisma/schema.prisma` | 数据模型（与规格 Section 5 对齐） |
| `scripts/seed-clients.ts`, `rotate-keys.ts` | 运维脚本 |

---

## 当前里程碑（避免范围蔓延）

README 里程碑表为准。撰写代码时：

- **M1/M2 已完成**：PrismaAdapter、custom server、注册登录、SSO cookie 短路、refresh rotation 审计、账户设备撤销、真 logout。
- **M3 进行中/待办**：内部 API 完善、HIBP/邮箱验证硬化、Section 10 checklist、`scripts/demo-client` 类集成验证。

未在规格或当前 milestone 内的功能，先与用户确认再实现。

---

## Agent 工作流 checklist

1. 读规格相关章节 + 本文件架构约束。
2. 小步修改；OIDC/URL/cookie 类改动说明验证步骤（`pnpm demo` 或手动 authorize 流）。
3. 完成前本地验证：`pnpm lint && pnpm build`（必过）；`pnpm test`（建议）。
4. 仅在上述检查全部通过后，才可 commit / push；未通过则继续修复，**禁止**推送会失败 CI 的代码。
5. 不扩大 diff：不顺手重构无关文件、不引入新依赖除非必要。
6. 文档：行为变更同步 `README.md`；**不要**除非用户要求才新建额外 markdown。
