# 生产部署说明（阿里云 ACR + GitHub Actions + shared-infra Caddy）

自动化链路：`push main` → GitHub Actions 构建并推送阿里云 ACR → SSH 到服务器执行 `deploy.sh`（从 ACR 拉取镜像）。

> 历史原因：曾使用 GHCR，但国内服务器拉取 GHCR 经常 `Run Command Timeout`，已改为阿里云 ACR。

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

## 5. 阿里云 ACR 准备

1. 登录阿里云容器镜像服务控制台（个人版即可）。
2. **建议在与服务器同地域建仓库**，可使用 VPC 内网拉取（免流量费、最快）。
   - 服务器在乌兰察布 → 在 `cn-wulanchabu` 建命名空间和仓库
   - 跨地域也能用，但只能走公网（仍远快于 GHCR）
3. 创建命名空间，例如 `ai-workshop`，访问权限设为「私有」。
4. 创建镜像仓库 `ai-workshop-sso`，仓库类型「本地仓库」。
5. 进入「访问凭证」，设置「固定密码」（个人版默认是临时密码，必须改成固定密码 CI 才能用）。
6. 记录以下地址：
   - 公网：`registry.<region>.aliyuncs.com`（CI 推送用）
   - VPC（同地域服务器可用）：`registry-vpc.<region>.aliyuncs.com`（服务器拉取用）

## 6. GitHub Actions Secrets

在 GitHub 仓库 Settings → Secrets → Actions 中配置以下 Secret：

| Secret | 必填 | 说明 |
|--------|------|------|
| `SERVER_HOST` | ✅ | 服务器公网 IP |
| `SERVER_PORT` | ✅ | SSH 端口（默认 `22`） |
| `SERVER_USER` | ✅ | 部署用户，建议 `deploy` |
| `SERVER_SSH_KEY` | ✅ | 部署用户 SSH 私钥 |
| `ALIYUN_REGISTRY` | ✅ | ACR **公网**地址，CI 推送使用，如 `registry.cn-wulanchabu.aliyuncs.com` |
| `ALIYUN_REGISTRY_INTERNAL` | ⛔ 可选 | 服务器**拉取**用地址。**同地域**填 VPC 地址 `registry-vpc.cn-wulanchabu.aliyuncs.com`；跨地域可不填，会自动用公网地址 |
| `ALIYUN_NAMESPACE` | ✅ | ACR 命名空间，如 `ai-workshop` |
| `ALIYUN_USERNAME` | ✅ | ACR 登录用户名（控制台「访问凭证」页） |
| `ALIYUN_PASSWORD` | ✅ | ACR 固定密码（务必在控制台设置「固定密码」） |

## 7. 首次上线顺序

1. 完成上述 §2 所有服务器手工准备
2. 完成 §5 阿里云 ACR 准备并在 §6 配置好 Secrets
3. DNS：`auth.aiprd.club` A 记录指向服务器 IP
4. 安全组放行 22（SSH）、80、443
5. push `main` → GitHub Actions 自动构建部署
6. 验收：
   ```bash
   curl -I https://auth.aiprd.club
   docker logs ai-workshop-sso-app --tail 100
   ```
7. （手工一次）注册 OIDC client：
   ```bash
   docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml exec app pnpm seed:clients
   ```
   将输出的 `client_id` / `client_secret` 同步到 `ai-course-copilot` 的 `.env.production` 并重启。

## 8. 常用命令

手动发布指定版本（在服务器上执行）：

```bash
cd /opt/ai-workshop-sso/deploy
export ALIYUN_REGISTRY='registry-vpc.cn-wulanchabu.aliyuncs.com'   # 同地域用 VPC；跨地域用公网
export ALIYUN_NAMESPACE='<你的命名空间>'
export ALIYUN_USERNAME='<ACR 用户名>'
export ALIYUN_PASSWORD='<ACR 固定密码>'
IMAGE_TAG=<git_sha> ./deploy.sh
```

查看应用状态与日志：

```bash
docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml ps
docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml logs -f app
```

## 9. 验收与回滚

### 9.1 发布验收

```bash
curl -I https://auth.aiprd.club
docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml ps
docker compose -f /opt/ai-workshop-sso/deploy/docker-compose.prod.yml logs --tail=100 app
```

### 9.2 回滚

```bash
cd /opt/ai-workshop-sso/deploy
export ALIYUN_REGISTRY='registry-vpc.cn-wulanchabu.aliyuncs.com'
export ALIYUN_NAMESPACE='<你的命名空间>'
export ALIYUN_USERNAME='<ACR 用户名>'
export ALIYUN_PASSWORD='<ACR 固定密码>'
IMAGE_TAG=<previous_sha> ./deploy.sh
```

Prisma 迁移遵循 expand/contract 策略，回滚前后镜像兼容。数据库迁移规则：

- 生产只执行 `pnpm prisma migrate deploy`
- 禁止在生产执行 `prisma db push`
