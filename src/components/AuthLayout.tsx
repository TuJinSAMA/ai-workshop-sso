import type { ReactNode } from "react";

// Shared visual shell for every auth-side page (login / register / password /
// verify-email / account). The look is intentionally close to AI Course
// Copilot's AuthGate so users moving between the RP and the SSO domain don't
// feel like they've crossed a brand boundary, but we never paste an RP's
// product copy here — this page belongs to the SSO and only the *client name*
// changes per request so the user can tell which platform they're
// authorizing into ("Sign in to continue to <client>"-style).

export function AuthLayout({
  clientName,
  title,
  subtitle,
  children,
  footer,
  width = "narrow",
}: {
  /** OAuthClient.name resolved from the interaction uid, when present. */
  clientName?: string | null;
  title: string;
  /** Used only when `clientName` is null (e.g. /account, direct-visit pages). */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Account page needs more room for device list etc. */
  width?: "narrow" | "wide";
}) {
  const maxWidth = width === "wide" ? "max-w-3xl" : "max-w-md";

  return (
    <div className="min-h-screen bg-[#f7f8fa] px-5 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <main className={`mx-auto flex min-h-[calc(100vh-5rem)] ${maxWidth} items-center justify-center`}>
        <div className="w-full space-y-5">
          <BrandStrip />

          <div className="rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950">
            <div className="p-6">
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {clientName ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  继续登录到{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {clientName}
                  </span>
                </p>
              ) : subtitle ? (
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</div>
              ) : null}
              <div className="mt-5">{children}</div>
            </div>
            {footer ? (
              <div className="border-t border-zinc-100 px-6 py-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
                {footer}
              </div>
            ) : null}
          </div>

          <p className="text-center text-xs text-zinc-400">
            由 AI Workshop 统一身份认证服务提供
          </p>
        </div>
      </main>
    </div>
  );
}

function BrandStrip() {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-indigo-600 shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
        <SparkIcon className="h-3.5 w-3.5" />
      </div>
      <span className="font-medium text-zinc-700 dark:text-zinc-300">AI Workshop</span>
      <span aria-hidden className="text-zinc-300">·</span>
      <span>统一身份认证</span>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {children}
    </span>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(15,23,42,0.02)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-indigo-500 dark:focus:ring-indigo-900 ${props.className ?? ""}`}
    />
  );
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <button
      {...props}
      className={`w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${props.className ?? ""}`}
    />
  );
}

export function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <button
      {...props}
      className={`rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 ${props.className ?? ""}`}
    />
  );
}

export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-indigo-600 hover:underline dark:text-indigo-400">
      {children}
    </a>
  );
}

export function Alert({
  variant,
  children,
}: {
  variant: "success" | "error" | "info";
  children: ReactNode;
}) {
  const styles = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    error:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
    info: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100",
  }[variant];
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${styles}`}>{children}</div>
  );
}

function SparkIcon({ className }: { className?: string }) {
  // Tiny inline glyph so we don't pull in lucide-react just for one icon.
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}
