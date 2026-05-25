import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We run via a custom Node server (src/server.ts) that co-hosts oidc-provider
  // alongside the Next handler. `output: "standalone"` is incompatible with a
  // custom server (per node_modules/next/dist/docs/01-app/02-guides/custom-server.md)
  // so it is intentionally not set here.
  serverExternalPackages: ["argon2", "pg", "oidc-provider", "@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
