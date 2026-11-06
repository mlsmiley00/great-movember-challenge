"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
export function AuthSubmit({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={disabled || pending} aria-busy={pending}>
      {children}
      {pending ? "…" : ""}
    </button>
  );
}
