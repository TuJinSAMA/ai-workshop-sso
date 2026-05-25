# ai-workshop-sso

统一身份认证服务（OIDC Provider），独立部署在 `auth.aiprd.club`，为 `ai-course-copilot` 等 AI 工具产品提供单点登录与跨产品账户互通。

> 详细规格见 `~/Documents/LiCode/ai-course-copilot/docs/ai-workshop-sso-spec.md`。
>
> **当前进度：Phase 0 / M2 已完成** — 在 M1（PrismaAdapter + custom server + 注册/登录闭环）基础上加入：`/oidc/auth` SSO 短路（interactionPolicy 注入 sso_cookie Check）、Refresh Token Rotation + 复用检测审计、`/account` 设备列表 + 撤销、`/api/logout` 真清 cookie + Session。下一步 M3：内部 API、HIBP 弱密码、邮箱验证 token、Section 10 安全 Checklist。

---

## 技术栈

- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **Prisma + PostgreSQL** — 用户、Session、RefreshToken、OAuthClient、SigningKey、AuditLog
- **oidc-provider** (panva) — OIDC 协议层（Auth Code + PKCE + RS256）
- **argon2** — 密码哈希（argon2id）
- **jose** — JWT 签名 / JWKS
- **zod** — 入参与环境变量校验
- **ioredis + rate-limiter-flexible** — 登录限频（普通 Redis 协议，无平台绑定）
- **Email**：抽象为 `EmailService` 接口；Phase 0 默认 `console`（只打日志、不真发）。后续接 Resend / 阿里云邮件推送只需切 `EMAIL_PROVIDER`
- **Docker + Caddy**：生产部署在阿里云 ECS，Caddy 自动签发 `auth.aiprd.club` 的 Let's Encrypt 证书

## 本地开发

前提：本地已有 Redis 在 `127.0.0.1:6379` 跑（`redis-cli ping` 返 PONG）。Postgres 用 docker 起就行；应用本身在宿主机 `pnpm dev` 跑（保留 HMR）。

```bash
# 1. 准备环境变量
cp .env.example .env
# 默认值已经能跑（postgres/postgres @ localhost:5432，redis @ localhost:6379）

# 2. 启动 Postgres（Redis 走你本机已有的实例）
docker compose up -d
docker compose ps    # 等 postgres healthy

# 3. 执行 Prisma 迁移
pnpm prisma migrate dev --name init

# 4. (可选) 注册一个 demo 客户端
pnpm seed:clients

# 5. 启动开发服务器
pnpm dev          # http://localhost:3000
```

> 如果你想完全脱离 docker，本地用原生 Postgres 也行，把 `DATABASE_URL` 指向你的实例即可，跳过 `docker compose up`。

健康端点：

- http://localhost:3000 — 导航首页
- http://localhost:3000/oidc/.well-known/openid-configuration — Discovery（由 oidc-provider 自动生成）
- http://localhost:3000/oidc/jwks — JWKS（首次访问自动生成 RSA 2048 keypair 并加密存入 DB）

> M1 起 OIDC 协议路由全部挂在 `/oidc/*` 前缀下，由 [src/server.ts](src/server.ts) 同进程的自定义 Node server 转发给 oidc-provider；其余路由仍走 Next.js handler。因此 `output: "standalone"` 已关闭（与 custom server 不兼容）。

> 如果你本地已有原生 Postgres / Redis，跳过 `docker compose up` 即可，只要 `DATABASE_URL` / `REDIS_URL` 指对即可。

## 部署到阿里云 ECS（Docker + Caddy）

前置条件：

1. 阿里云安全组放开 **80** 和 **443**（Caddy 自动签证书要用 80 验证 HTTP-01）。
2. `auth.aiprd.club` 的 A 记录指向你的 ECS 公网 IP，**先解析生效再启动 Caddy**。
3. 服务器上装好 Docker + Docker Compose plugin。

部署步骤：

```bash
# 在服务器上 clone 仓库后：
cp .env.example .env.production
# 用 openssl rand -hex 32 生成 COOKIE_SECRET / INTERNAL_API_TOKEN / JWKS_ENCRYPTION_KEY
# 设 POSTGRES_PASSWORD、ISSUER_URL=https://auth.aiprd.club、SSO_COOKIE_DOMAIN=.aiprd.club

docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 首次部署执行迁移：
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec app sh -c 'pnpm prisma migrate deploy'
```

栈结构：`caddy` → `app` (custom Node server via `tsx src/server.ts`，端口 3000) → `postgres` / `redis`。Caddy 会自动申请并续期 Let's Encrypt 证书，配置在 `deploy/Caddyfile`，已包含 HSTS / CSP / X-Frame-Options 等头。

回滚 / 升级：`docker compose -f docker-compose.prod.yml pull && up -d`（用镜像仓库）或重新 `build && up -d`（本地构建）。

## 关于私钥与 KMS

- 当前 JWKS 私钥用 **AES-256-GCM 加密后**存入 `SigningKey.privateKeyPem` 列。
- 主密钥来源：`JWKS_ENCRYPTION_KEY` 环境变量（32 字节 hex），未配置时从 `COOKIE_SECRET` 派生（仅 dev 可接受）。
- **KMS 不是必需**。阿里云 KMS 按调用次数 + 密钥实例费收费，Phase 0 不上 KMS 完全没问题。后续若想升级，只需把 `src/lib/crypto.ts` 的 `getMasterKey()` 换成 KMS Decrypt 调用。

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
│   │   ├── db.ts             ✓  PrismaClient 单例（pg adapter）
│   │   ├── redis.ts          ✓  ioredis 单例
│   │   ├── password.ts       ✓  argon2id + verifyAndUpgrade()
│   │   ├── jwks.ts           ✓  DB-backed JWKS（私钥 AES-256-GCM 加密）
│   │   ├── crypto.ts         ✓  AES-256-GCM at-rest secret 加解密
│   │   ├── cookies.ts        ✓  SSO Cookie 工具
│   │   ├── rate-limit.ts     ✓  Redis sliding window（无 REDIS_URL 退化为内存）
│   │   ├── audit.ts          ✓  AuditLog 写入
│   │   ├── email.ts          ✓  EmailService 抽象（默认 console，不真发）
│   │   ├── auth-state.ts     ✓  PKCE / state 工具
│   │   ├── oidc-adapter.ts   ✓  PrismaAdapter（OidcModel 单表存储）
│   │   ├── interaction.ts    ✓  bridge：Next 路由完成 oidc-provider Interaction
│   │   └── oidc-provider.ts  ✓  Prisma adapter + DB clients + 私钥 JWKS
│   ├── server.ts             ✓  custom Node server：/oidc/* 转 oidc-provider，其余走 Next
│   └── middleware.ts         ✓  /api/internal/* 鉴权
├── deploy/
│   └── Caddyfile             ✓  auth.aiprd.club 自动 HTTPS + 安全头
├── docker-compose.yml        ✓  本地 dev infra（pg + redis）
├── docker-compose.prod.yml   ✓  生产全栈（pg + redis + app + caddy）
├── Dockerfile                ✓  Next.js standalone 多阶段构建
├── scripts/
│   ├── seed-clients.ts       ◐
│   ├── rotate-keys.ts        ✓
│   └── import-legacy-users.ts (TODO Phase 1)
├── tests/
└── .env.example
```

图例：✓ 完成 ｜ ◐ 部分实现 ｜ TODO 待做

## Phase 0 里程碑进度

| 里程碑 | 范围 | 状态 |
|---|---|---|
| **M1** | OIDC PrismaAdapter；custom server 同进程托管 OIDC + Next；`/api/register` + `/api/login` zod/argon2/限频/审计；登录后调 oidc-provider Interaction 完成 OIDC flow；Discovery/JWKS 交还 oidc-provider；Vitest 起步 | ✓ 完成（本 PR） |
| **M2** | `/oidc/auth` interactionPolicy 注入 sso_cookie Check → 命中 `aiprd_sso` 直接 `loginAccount`；显式 `rotateRefreshToken: true` + `grant.revoked` / `grant.success` 钩子写 `token_refresh_reuse_detected` / `token_issued` / `token_refreshed` / `session_revoked` 审计；/account 服务端组件列设备 + 撤销按钮；`/api/sessions/[id]/revoke` 同步 revokeByGrantId 兜底；/api/logout 真清 SSO cookie + Session.revokedAt + 启用 rpInitiatedLogout | ✓ 完成（本 PR） |
| **M3** | 内部 API（clients / users.import / keys.rotate / users[id]/disable）；`scripts/demo-client.ts`（openid-client + jose 验签 + 二次 authorize 验 SSO）；HIBP 弱密码 + 邮箱验证 token + CSP 精修；Section 10 安全 Checklist 对照表 | TODO |

## 安全提醒

- 所有 `COOKIE_SECRET` / `INTERNAL_API_TOKEN` 在生产必须用 `openssl rand -hex 32` 替换。
- 部署到 `auth.aiprd.club` 前请通读规格 Section 10 的安全 Checklist。
- 本服务**永远不直连任何业务库**，跨服务通信走 HTTPS + OIDC。
