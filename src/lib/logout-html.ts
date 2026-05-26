import type { KoaContextWithOIDC } from "oidc-provider";

// Custom HTML for oidc-provider's RP-initiated logout flow.
//
// Both pages render outside Next.js (Koa middleware), so Tailwind isn't
// available. We inline a tiny stylesheet that mirrors AuthLayout.tsx — same
// surface color, card, brand strip, and footer — so the user doesn't feel
// they've crossed into a different product when oidc-provider asks them to
// confirm sign-out.

const SHARED_CSS = `
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:#f7f8fa;color:#18181b;-webkit-font-smoothing:antialiased;min-height:100vh;padding:40px 20px;display:flex;flex-direction:column}
  main{margin:0 auto;width:100%;max-width:28rem;flex:1;display:flex;align-items:center;justify-content:center}
  .stack{width:100%;display:flex;flex-direction:column;gap:1.25rem}
  .brand{display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:#71717a}
  .brand-mark{display:flex;align-items:center;justify-content:center;height:1.75rem;width:1.75rem;border-radius:.5rem;border:1px solid #e4e4e7;background:#fff;color:#4f46e5;box-shadow:0 1px 2px rgba(15,23,42,.06)}
  .brand-name{font-weight:500;color:#3f3f46}
  .brand-sep{color:#d4d4d8}
  .card{border-radius:.75rem;border:1px solid rgba(228,228,231,.8);background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.06);overflow:hidden}
  .card-body{padding:1.5rem}
  .title{margin:0;font-size:1.25rem;font-weight:600;letter-spacing:-.01em;color:#18181b}
  .subtitle{margin:.25rem 0 0;font-size:.875rem;color:#52525b}
  .subtitle strong{font-weight:500;color:#18181b}
  .actions{margin-top:1.25rem;display:flex;flex-direction:column;gap:.625rem}
  .btn{appearance:none;width:100%;display:inline-flex;align-items:center;justify-content:center;padding:.625rem 1rem;font-size:.875rem;font-weight:500;border-radius:.5rem;border:1px solid transparent;cursor:pointer;transition:background-color .15s ease,border-color .15s ease;font-family:inherit}
  .btn:focus{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 4px #18181b}
  .btn-primary{background:#18181b;color:#fff;box-shadow:0 1px 2px rgba(15,23,42,.08)}
  .btn-primary:hover{background:#27272a}
  .btn-secondary{background:#fff;color:#3f3f46;border-color:#e4e4e7;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .btn-secondary:hover{background:#fafafa}
  .footer-note{text-align:center;font-size:.75rem;color:#a1a1aa;margin:0}
  #op\\.logoutForm{display:none}
`;

const BRAND_STRIP = `
  <div class="brand">
    <span class="brand-mark" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>
    </span>
    <span class="brand-name">AI Workshop</span>
    <span class="brand-sep" aria-hidden="true">·</span>
    <span>统一身份认证</span>
  </div>
`;

const FOOTER_NOTE = `<p class="footer-note">由 AI Workshop 统一身份认证服务提供</p>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderShell(title: string, bodyInner: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)} · AI Workshop</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<main>
  <div class="stack">
    ${BRAND_STRIP}
    <div class="card"><div class="card-body">${bodyInner}</div></div>
    ${FOOTER_NOTE}
  </div>
</main>
</body>
</html>`;
}

export async function logoutSource(
  ctx: KoaContextWithOIDC,
  form: string,
): Promise<void> {
  const clientName = ctx.oidc.client?.clientName;
  const subtitle = clientName
    ? `即将从 <strong>${escapeHtml(clientName)}</strong> 退出登录，是否继续？`
    : "即将退出统一身份认证，是否继续？";

  const inner = `
    <h1 class="title">确认退出登录</h1>
    <p class="subtitle">${subtitle}</p>
    ${form}
    <div class="actions">
      <button class="btn btn-primary" autofocus type="submit" form="op.logoutForm" value="yes" name="logout">退出登录</button>
      <button class="btn btn-secondary" type="submit" form="op.logoutForm">取消，保持登录</button>
    </div>
  `;

  ctx.type = "html";
  ctx.body = renderShell("退出登录", inner);
}

export async function postLogoutSuccessSource(
  ctx: KoaContextWithOIDC,
): Promise<void> {
  const clientName = ctx.oidc.client?.clientName;
  const subtitle = clientName
    ? `已从 <strong>${escapeHtml(clientName)}</strong> 退出登录。`
    : `已退出统一身份认证。`;

  const inner = `
    <h1 class="title">已成功退出</h1>
    <p class="subtitle">${subtitle}你可以关闭此页面，或返回登录。</p>
    <div class="actions">
      <a class="btn btn-secondary" href="/login" style="text-decoration:none">返回登录</a>
    </div>
  `;

  ctx.type = "html";
  ctx.body = renderShell("已退出登录", inner);
}
