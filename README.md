# ai-workshop-sso

统一身份认证服务（OIDC Provider），独立部署在 `auth.aiprd.club`，为 `ai-course-copilot` 等 AI 工具产品提供单点登录与跨产品账户互通。

> 详细规格见 `~/Documents/LiCode/ai-course-copilot/docs/ai-workshop-sso-spec.md`。本仓库当前处于 **Phase 0 骨架阶段**：项目结构、依赖、Prisma schema、库文件占位、路由占位、JWKS 与 Discovery 已就绪；具体业务逻辑（oidc-provider 适配器、登录/注册、SSO Cookie 流程、限频、邮件）待实现。

---

## 技术栈

- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **Prisma + PostgreSQL** — 用户、Session、RefreshToken、OAuthClient、SigningKey、AuditLog
- **oidc-provider** (panva) — OIDC 协议层（Auth Code + PKCE + RS256）
- **argon2** — 密码哈希（argon2id）
- **jose** — JWT 签名 / JWKS
- **zod** — 入参与环境变量校验
- **@upstash/ratelimit + Upstash Redis** — 登录限频
- **Resend** — 邮件（抽象为 `EmailService` 接口，可替换为阿里云邮件推送）

## 快速开始

```bash
# 1. 安装依赖（已完成）
pnpm install

# 2. 准备环境变量
cp .env.example .env
# 编辑 .env，填写真实 DATABASE_URL、COOKIE_SECRET、INTERNAL_API_TOKEN

# 3. 准备本地 Postgres（按你本地 Postgres 用户密码改 DATABASE_URL）
createdb ai_workshop_sso

# 4. 执行 Prisma 迁移
pnpm prisma migrate dev --name init

# 5. 注册一个 demo 客户端（输出 client_secret 一次）
pnpm seed:clients

# 6. 启动开发服务器
pnpm dev          # http://localhost:3000
```

打开 http://localhost:3000 应该看到导航首页。Discovery / JWKS 端点：

- http://localhost:3000/api/well-known/openid-configuration
- http://localhost:3000/api/well-known/jwks.json （首次访问会自动生成并持久化 RSA 2048 keypair）

## 目录结构

```
ai-workshop-sso/
├── prisma/
│   └── schema.prisma                ← Section 5 完整 schema
├── src/
│   ├── app/
│   │   ├── login/, register/, password/{forgot,reset}/
│   │   ├── account/, verify-email/, logout/
│   │   └── api/
│   │       ├── oauth/{authorize,token,revoke,userinfo}/route.ts   (TODO)
│   │       ├── login/, register/, logout/, password/{forgot,reset}/
│   │       ├── well-known/{openid-configuration,jwks.json}/       ✓
│   │       └── internal/{users,clients,keys}/                     (TODO)
│   ├── lib/
│   │   ├── env.ts            ✓  zod 校验 + 缓存
│   │   ├── db.ts             ✓  PrismaClient 单例
│   │   ├── password.ts       ✓  argon2id + verifyAndUpgrade()
│   │   ├── jwks.ts           ✓  DB-backed JWKS 加载/轮换
│   │   ├── cookies.ts        ✓  SSO Cookie 工具
│   │   ├── rate-limit.ts     ✓  Upstash 限频（无配置则 no-op）
│   │   ├── audit.ts          ✓  AuditLog 写入
│   │   ├── email.ts          ✓  EmailService 抽象（Resend / Console）
│   │   ├── auth-state.ts     ✓  PKCE / state 工具
│   │   └── oidc-provider.ts  ◐  框架就绪，Prisma 适配器待补
│   └── middleware.ts         ✓  /api/internal/* 鉴权
├── scripts/
│   ├── seed-clients.ts       ◐
│   ├── rotate-keys.ts        ✓
│   └── import-legacy-users.ts (TODO Phase 1)
├── tests/
└── .env.example
```

图例：✓ 完成 ｜ ◐ 部分实现 ｜ TODO 待做

## 当前 Phase 0 待办（按规格 Section 12）

1. **oidc-provider Prisma 适配器** — 把 AuthorizationCode / RefreshToken / Session / OAuthClient 模型接到 `oidc-provider` 的存储接口。
2. **登录 / 注册 / 登出业务路由** — `/api/login`、`/api/register`、`/api/logout` 走 zod 校验、argon2 哈希、HIBP 弱密码、限频、审计、写 SSO Cookie，并与 oidc-provider 的 interaction 流程对接。
3. **Refresh Token Rotation** — 重用旧 token 立即吊销整条 Session，写 `token_refresh_reuse_detected` 审计。
4. **/oauth/authorize** — 已有 SSO Cookie 直接颁发 code；否则 302 跳 `/login?interaction=...`。
5. **找回密码 / 邮箱验证** — 邮件服务接通。
6. **Demo Client** — 独立小脚本/页面验证完整 OIDC + SSO 流程。
7. **安全 Checklist（Section 10）** — 逐项确认后 commit。

## 安全提醒

- 所有 `COOKIE_SECRET` / `INTERNAL_API_TOKEN` 在生产必须用 `openssl rand -hex 32` 替换。
- 部署到 `auth.aiprd.club` 前请通读规格 Section 10 的安全 Checklist。
- 本服务**永远不直连任何业务库**，跨服务通信走 HTTPS + OIDC。
