import { AuthLayout, InlineLink } from "@/components/AuthLayout";

// Dev-only landing. In production users never visit `/` directly — they
// always arrive via /oidc/auth from a registered client.
export default function Home() {
  return (
    <AuthLayout
      title="AI Workshop 统一身份认证"
      subtitle="本服务为所有 AI Workshop 旗下产品提供统一登录。请通过具体产品的登录入口使用，而不是直接访问本页面。"
    >
      <ul className="space-y-1.5 text-sm">
        <li>
          <InlineLink href="/login">/login</InlineLink>
          <span className="ml-2 text-zinc-500">登录</span>
        </li>
        <li>
          <InlineLink href="/register">/register</InlineLink>
          <span className="ml-2 text-zinc-500">注册</span>
        </li>
        <li>
          <InlineLink href="/account">/account</InlineLink>
          <span className="ml-2 text-zinc-500">账户管理</span>
        </li>
        <li>
          <InlineLink href="/api/well-known/openid-configuration">
            /.well-known/openid-configuration
          </InlineLink>
          <span className="ml-2 text-zinc-500">OIDC Discovery</span>
        </li>
        <li>
          <InlineLink href="/api/well-known/jwks.json">/.well-known/jwks.json</InlineLink>
          <span className="ml-2 text-zinc-500">JWKS</span>
        </li>
      </ul>
    </AuthLayout>
  );
}
