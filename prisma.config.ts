import { defineConfig } from "prisma/config";
import "dotenv/config";

// Prisma 7 moved datasource URL out of schema.prisma; it now lives here.
// See: https://pris.ly/d/prisma7-client-config
//
// 注意：这里不使用 `env("DATABASE_URL")`，因为它在变量缺失时会直接抛
// PrismaConfigEnvError，导致 CI 中的 `prisma generate` 失败（generate
// 阶段并不需要真实数据库连接）。改为读取 process.env 并提供占位符，
// 运行时 `prisma migrate` / runtime client 仍会要求真实的 DATABASE_URL。
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
