import type { NextConfig } from "next";

// Content Security Policy for the SSO service.
// Next.js App Router injects inline hydration scripts, so script-src needs
// 'unsafe-inline'. For a stricter setup, use middleware-based nonce injection.
//
// `upgrade-insecure-requests` and HSTS are HTTPS-only directives — leaving
// them enabled in `next dev` (plain http://localhost) causes the browser to
// rewrite our 303 Location (http://localhost:3000/oidc/auth/<uid>) to https,
// which has no listener and silently aborts the navigation, leaving the user
// stranded on /login. Production traffic flows through Caddy/HTTPS so this
// only matters in dev.
const isProd = process.env.NODE_ENV === "production";

const CSP = [
  "default-src 'self'",
  // Next.js App Router requires unsafe-inline for hydration scripts.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind generates inline styles via Tailwind CSS.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // OIDC redirects only go to the same origin or registered RP callback URLs.
  "connect-src 'self'",
  // NOTE: intentionally NO `form-action` directive.
  //
  // The OIDC login flow is:
  //   POST /api/login → 303 /oidc/auth/<uid> → 303 <RP redirect_uri>
  // and that final hop crosses origin (e.g. http://localhost:5002/api/auth/
  // callback/sso). CSP `form-action` is enforced on *every* hop of a form
  // navigation, including redirect chains, so any value tighter than the
  // full set of registered RP origins silently breaks SSO and leaves the
  // user stranded on /login. The actual security gate for that final hop
  // is oidc-provider's strict `redirect_uri` allowlist (per OAuthClient
  // row), which is the correct place for that check.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
]
  .join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: CSP,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // HSTS: tell browsers to always use HTTPS (2 years, includeSubDomains).
  // Caddy also sets this in production; keep it off in dev so the browser
  // doesn't permanently pin http://localhost to HTTPS (which then breaks
  // every later dev session until HSTS is manually cleared).
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // We run via a custom Node server (src/server.ts) that co-hosts oidc-provider
  // alongside the Next handler. `output: "standalone"` is incompatible with a
  // custom server (per node_modules/next/dist/docs/01-app/02-guides/custom-server.md)
  // so it is intentionally not set here.
  serverExternalPackages: ["argon2", "pg", "oidc-provider", "@prisma/client", "@prisma/adapter-pg"],
  async headers() {
    return [
      {
        // Apply security headers to all Next.js-rendered routes.
        // OIDC endpoints (/oidc/*) are served by the custom Node server and
        // are NOT processed by Next.js headers(), so their headers must be set
        // in server.ts if needed. The browser-facing login/register/account
        // pages all live under Next.js routing.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
