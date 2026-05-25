// Custom Node server: mounts oidc-provider under /oidc/* in the same
// process as the Next.js handler. See plan §1.4 and AGENTS.md (custom
// server is incompatible with output:standalone, which is now disabled
// in next.config.ts).

// Load .env / .env.local BEFORE any module that reads process.env at
// import time (db.ts builds the Prisma adapter eagerly from DATABASE_URL).
// Next's own loader runs inside app.prepare(), which is too late for us.
import "dotenv/config";

import http from "node:http";
import next from "next";

import { getProvider } from "./lib/oidc-provider";

async function main(): Promise<void> {
  const dev = process.env.NODE_ENV !== "production";
  const port = Number(process.env.PORT ?? 3000);
  const hostname = process.env.HOSTNAME ?? "0.0.0.0";

  const app = next({ dev, hostname, port });
  await app.prepare();
  const nextHandler = app.getRequestHandler();

  const provider = await getProvider();
  const oidcCallback = provider.callback();

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/oidc" || url.startsWith("/oidc/") || url.startsWith("/oidc?")) {
      // oidc-provider's Koa app routes against `req.url` using the default
      // unprefixed route paths (`/auth`, `/token`, …), but its urlFor()
      // helper recovers the mount prefix by diffing `req.originalUrl` from
      // `ctx.request.url`. So we strip /oidc from url but stash the original
      // so the emitted absolute URLs (discovery, redirects, iss) stay correct.
      // See node_modules/oidc-provider/lib/helpers/oidc_context.js urlFor().
      (req as http.IncomingMessage & { originalUrl?: string }).originalUrl = url;
      req.url = url.replace(/^\/oidc/, "") || "/";
      return oidcCallback(req, res);
    }
    return nextHandler(req, res);
  });

  server.listen(port, hostname, () => {
    console.log(`> ai-workshop-sso ready on http://${hostname}:${port} (dev=${dev})`);
    console.log(`> OIDC discovery: http://${hostname}:${port}/oidc/.well-known/openid-configuration`);
  });
}

main().catch((err) => {
  console.error("[server] fatal", err);
  process.exit(1);
});
