/**
 * placeholder button. real shadcn primitives land in T-003 via:
 *   npx shadcn@latest init
 *   npx shadcn@latest add button input dialog dropdown-menu popover sheet card
 *
 * delete this file once shadcn init runs.
 */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", ...rest },
  ref,
) {
  const base =
    "inline-flex h-11 items-center justify-center rounded-md px-6 font-sans text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
  const variantClass =
    variant === "primary"
      ? "bg-[var(--nova-accent)] text-[var(--lunari-bg-deep)] hover:opacity-90"
      : "bg-transparent text-[var(--lunari-fg-muted)] hover:text-[var(--lunari-fg-primary)]";
  return <button ref={ref} className={cn(base, variantClass, className)} {...rest} />;
});
