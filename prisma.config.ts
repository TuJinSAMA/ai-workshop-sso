import { defineConfig, env } from "prisma/config";
import "dotenv/config";

// Prisma 7 moved datasource URL out of schema.prisma; it now lives here.
// See: https://pris.ly/d/prisma7-client-config

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
