import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal self-contained server bundle for Docker.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  output: "standalone",

  // Native deps (argon2 / pg / oidc-provider) must stay external.
  serverExternalPackages: ["argon2", "pg", "oidc-provider", "@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
