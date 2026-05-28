"use client";

import type { FormEvent, ReactNode } from "react";

type ClientPostFormProps = {
  action: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  className?: string;
  noValidate?: boolean;
  children: ReactNode;
};

/**
 * Client form with fetch handler — still declares method="POST" + action so a
 * hydration/JS failure falls back to the API route instead of GET on the page URL.
 */
export function ClientPostForm({
  action,
  onSubmit,
  className,
  noValidate,
  children,
}: ClientPostFormProps) {
  return (
    <form
      method="POST"
      action={action}
      onSubmit={onSubmit}
      className={className}
      noValidate={noValidate}
    >
      {children}
    </form>
  );
}
