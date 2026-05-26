# 生产部署说明（阿里云 + GHCR + GitHub Actions + shared-infra Caddy）

自动化链路：`push main` → GitHub Actions 构建并推送 GHCR → SSH 到服务器执行 `deploy.sh`。

## 1. 服务器目录结构

```text
/opt/shared-infra/                 # Postgres + Redis + Caddy（共享基础设施，手工管理）
├── docker-compose.yml             # 包含 shared-postgres / shared-redis / shared-caddy
├── .env                           # POSTGRES_PASSWORD
├── caddy/Caddyfile                # 含 auth.aiprd.club 反代块
└── data/
    ├── postgres/
    ├── redis/
    ├── caddy/data/
    └── caddy/config/

/opt/ai-workshop-sso/              # 本应用
├── .env.production                # chown deploy:deploy, chmod 600
└── deploy/
    ├── docker-compose.prod.yml    # 由 CI 推送
    └── deploy.sh                  # 由 CI 推送
```

> **注意**：shared-infra（Postgres / Redis / Caddy）由服务器手工维护，不在本仓库内。

## 2. 一次性服务器侧手工准备

### 2.1 shared-infra：新增 Redis（如尚未添加）

编辑 `/opt/shared-infra/docker-compose.yml`，在 services 下追加 `redis` 服务，然后：

```bash
mkdir -p /opt/shared-infra/data/redis
cd /opt/shared-infra && docker compose up -d redis
```

### 2.2 新建 SSO 数据库和用户

```bash
docker exec -it shared-postgres psql -U postgres <<'SQL'
CREATE USER sso_user WITH PASSWORD '<openssl rand -hex 24>';
CREATE DATABASE ai_workshop_sso OWNER sso_user;
GRANT ALL PRIVILEGES ON DATABASE ai_workshop_sso TO sso_user;
SQL
```

### 2.3 Caddyfile 追加 auth.aiprd.club 块

编辑 `/opt/shared-infra/caddy/Caddyfile`，追加 `auth.aiprd.club { ... }` 块后：

```bash
docker exec shared-caddy caddy reload --config /etc/caddy/Caddyfile
```

### 2.4 创建应用目录和环境文件

```bash
mkdir -p /opt/ai-workshop-sso/deploy
chown -R deploy:deploy /opt/ai-workshop-sso
# 参考 deploy/env.production.example 填写真实值
vim /opt/ai-workshop-sso/.env.production
chmod 600 /opt/ai-workshop-sso/.env.production
```

## 3. 应用环境变量

参考 `deploy/env.production.example`，关键变量：

| 变量 | 说明 |
|------|------|
| `ISSUER_URL` | `https://auth.aiprd.club` |
| `DATABASE_URL` | `postgresql://sso_user:<密码>@shared-postgres:5432/ai_workshop_sso?schema=public` |
| `REDIS_URL` | `redis://shared-redis:6379` |
| `COOKIE_SECRET` | `openssl rand -hex 32` |
| `JWKS_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `INTERNAL_API_TOKEN` | `openssl rand -hex 32` |

密码建议使用 `openssl rand -hex 24`，避免 URL 编码问题。

## 4. 网络约束（shared-infra）

`shared-postgres`、`shared-redis`、`shared-caddy` 与 `ai-workshop-sso-app` 均加入 `shared-infra` Docker 网络：

- Caddy 通过容器名 `ai-workshop-sso-app:3000` 反代
- 应用通过 `shared-postgres:5432` 访问数据库
- 应用通过 `shared-redis:6379` 访问缓存

## 5. GitHub Actions Secrets

在 GitHub 仓库 Settings → Secrets → Actions 中配置以下 6 个 Secret：

| Secret | 说明 |
|--------|------|
| `SERVER_HOST` | 服务器公网 IP |
| `SERVER_PORT` | SSH 端口（默认 `22`） |
| `SERVER_USER` | 部署用户，建议 `deploy` |
| `SERVER_SSH_KEY` | 部署用户 SSH 私钥 |
| `GHCR_USERNAME` | GitHub 用户名 |
| `GHCR_PAT` | 有 `read:packages` 权限的 PAT |

## 6. 首次上线顺序

1. 完成上述 §2 所有服务器手工准备
2. DNS：`auth.aiprd.club` A 记录指向服务器 IP
3. 安全组放行 22（SSH）、80、443
4. push `main` → GitHub Actions 自动构建部署
5. 验收：
   ```bash
   curl -I https://auth.aiprd.club
   docker logs ai-workshop-sso-app --tail 100
   ```
6. （手工一次）注册 OIDC client：
   ```bash
   docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml exec app pnpm seed:clients
   ```
   将输出的 `client_id` / `client_secret` 同步到 `ai-course-copilot` 的 `.env.production` 并重启。

## 7. 常用命令

手动发布指定版本：

```bash
cd /opt/ai-workshop-sso/deploy
IMAGE_TAG=<git_sha> GHCR_OWNER=<github_owner> ./deploy.sh
```

查看应用状态与日志：

```bash
docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml ps
docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml logs -f app
```

## 8. 验收与回滚

### 8.1 发布验收

```bash
curl -I https://auth.aiprd.club
docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml ps
docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml logs --tail=100 app
```

### 8.2 回滚

```bash
cd /opt/ai-workshop-sso/deploy
IMAGE_TAG=<previous_sha> GHCR_OWNER=<github_owner> ./deploy.sh
```

Prisma 迁移遵循 expand/contract 策略，回滚前后镜像兼容。数据库迁移规则：

- 生产只执行 `pnpm prisma migrate deploy`
- 禁止在生产执行 `prisma db push`
