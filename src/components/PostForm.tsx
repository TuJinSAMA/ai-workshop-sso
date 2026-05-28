import type { ReactNode } from "react";

type PostFormProps = {
  action: string;
  className?: string;
  children: ReactNode;
};

/** Server-safe HTML form — always POST so a missing JS handler cannot GET-submit secrets. */
export function PostForm({ action, className, children }: PostFormProps) {
  return (
    <form method="POST" action={action} className={className}>
      {children}
    </form>
  );
}
