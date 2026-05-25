export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-12 font-sans">
      <h1 className="mb-4 text-3xl font-semibold">ai-workshop-sso</h1>
      <p className="mb-8 text-gray-600">
        统一身份认证服务（OIDC Provider）。本页面只是开发占位，正式入口请通过各业务产品的登录跳转使用。
      </p>
      <ul className="space-y-2 text-sm">
        <li>
          <a className="text-blue-600 hover:underline" href="/login">/login</a> — 登录
        </li>
        <li>
          <a className="text-blue-600 hover:underline" href="/register">/register</a> — 注册
        </li>
        <li>
          <a className="text-blue-600 hover:underline" href="/api/well-known/openid-configuration">
            /.well-known/openid-configuration
          </a>{" "}
          — Discovery
        </li>
        <li>
          <a className="text-blue-600 hover:underline" href="/api/well-known/jwks.json">
            /.well-known/jwks.json
          </a>{" "}
          — JWKS
        </li>
      </ul>
    </main>
  );
}
