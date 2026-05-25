/**
 * HTML + plain-text email templates for transactional emails.
 * All URLs are absolute (ISSUER_URL as base).
 */
import { env } from "./env";

function baseUrl(): string {
  return env().ISSUER_URL.replace(/\/+$/, "");
}

// ── Password reset ───────────────────────────────────────────────────────────

export function passwordResetEmail(token: string): { subject: string; html: string; text: string } {
  const url = `${baseUrl()}/password/reset?token=${encodeURIComponent(token)}`;
  const subject = "重置你的密码 - AI Workshop SSO";
  const text = `你正在申请重置密码。\n\n请点击以下链接（30 分钟内有效）：\n${url}\n\n若非本人操作，请忽略此邮件。`;
  const html = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="font-size:20px;margin-bottom:12px;">重置你的密码</h2>
  <p style="color:#444;line-height:1.6;">你正在申请重置密码。请点击下方按钮（<strong>30 分钟</strong>内有效）：</p>
  <a href="${url}" style="display:inline-block;margin:16px 0;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">
    重置密码
  </a>
  <p style="color:#888;font-size:13px;">若按钮无法点击，请复制此链接到浏览器：<br/><a href="${url}">${url}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="color:#aaa;font-size:12px;">若非本人操作，请忽略此邮件，你的密码不会被修改。</p>
</div>`;
  return { subject, html, text };
}

// ── Email verification ───────────────────────────────────────────────────────

export function emailVerificationEmail(token: string, email: string): { subject: string; html: string; text: string } {
  const url = `${baseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "验证你的邮箱 - AI Workshop SSO";
  const text = `请验证邮箱 ${email}。\n\n点击以下链接（24 小时内有效）：\n${url}\n\n若非本人操作，请忽略此邮件。`;
  const html = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="font-size:20px;margin-bottom:12px;">验证你的邮箱</h2>
  <p style="color:#444;line-height:1.6;">请点击下方按钮验证 <strong>${email}</strong>（<strong>24 小时</strong>内有效）：</p>
  <a href="${url}" style="display:inline-block;margin:16px 0;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">
    验证邮箱
  </a>
  <p style="color:#888;font-size:13px;">若按钮无法点击，请复制此链接到浏览器：<br/><a href="${url}">${url}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="color:#aaa;font-size:12px;">若非本人操作，请忽略此邮件。</p>
</div>`;
  return { subject, html, text };
}

// ── Anomaly login alert ──────────────────────────────────────────────────────

export function newDeviceLoginEmail(params: {
  email: string;
  ipAddress: string;
  userAgent: string;
  loginAt: Date;
}): { subject: string; html: string; text: string } {
  const { email, ipAddress, userAgent, loginAt } = params;
  const accountUrl = `${baseUrl()}/account`;
  const timeStr = loginAt.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const subject = "检测到新设备登录 - AI Workshop SSO";
  const text = [
    `你的账户 ${email} 刚刚在一个新设备/IP 上登录。`,
    `时间：${timeStr}`,
    `IP 地址：${ipAddress}`,
    `设备：${userAgent}`,
    "",
    `若为本人操作，无需处理。若非本人，请立即登录并撤销可疑会话：${accountUrl}`,
  ].join("\n");
  const html = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="font-size:20px;margin-bottom:12px;">检测到新设备登录</h2>
  <p style="color:#444;line-height:1.6;">你的账户 <strong>${email}</strong> 刚刚在一个新设备上登录：</p>
  <table style="width:100%;border-collapse:collapse;margin:12px 0;">
    <tr><td style="padding:6px 0;color:#888;width:80px;">时间</td><td style="padding:6px 0;">${timeStr}</td></tr>
    <tr><td style="padding:6px 0;color:#888;">IP 地址</td><td style="padding:6px 0;">${ipAddress}</td></tr>
    <tr><td style="padding:6px 0;color:#888;">设备</td><td style="padding:6px 0;font-size:12px;">${userAgent}</td></tr>
  </table>
  <p style="color:#444;line-height:1.6;">若为本人操作，无需处理。若非本人，请立即检查你的账户：</p>
  <a href="${accountUrl}" style="display:inline-block;margin:8px 0;padding:10px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;">
    查看我的设备
  </a>
</div>`;
  return { subject, html, text };
}
