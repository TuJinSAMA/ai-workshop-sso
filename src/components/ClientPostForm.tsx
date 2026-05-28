"use client";

import { useSyncExternalStore, type FormEvent, ReactNode } from "react";

function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type ClientPostFormProps = {
  action: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  className?: string;
  noValidate?: boolean;
  children: ReactNode;
};

/**
 * Client form with fetch handler. Declares method="POST" + action for no-JS
 * fallback; always preventDefault once hydrated so we never double-submit.
 * Pre-hydration native POST is handled by API 303 back to the auth page.
 */
export function ClientPostForm({
  action,
  onSubmit,
  className,
  noValidate,
  children,
}: ClientPostFormProps) {
  const hydrated = useHydrated();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hydrated) return;
    void onSubmit(e);
  }

  return (
    <form
      method="POST"
      action={action}
      onSubmit={handleSubmit}
      className={className}
      noValidate={noValidate}
    >
      {children}
    </form>
  );
}
