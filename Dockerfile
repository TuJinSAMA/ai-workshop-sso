# syntax=docker/dockerfile:1.7

# ---------- base ----------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /app

# argon2 / pg native builds need a toolchain in the deps stage only.
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential pkg-config libssl-dev ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- build ----------
FROM deps AS build
COPY . .
# Prisma client must be generated against the schema before `next build`.
RUN pnpm prisma generate
RUN pnpm build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# Runtime native libs only (no compiler toolchain).
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output bundles node_modules + .next/server.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Prisma schema + generated client engine files (needed at runtime).
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
