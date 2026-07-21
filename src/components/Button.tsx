import Link from "next/link";
import type { ComponentProps } from "react";

// Shared pill-button styling per the Figma "Button Short"/"Button Long"
// components (task #24) — consolidates a classname pattern that was
// previously duplicated ad-hoc across AddForm/page/recipe-detail/login.
type Variant = "primary" | "secondary";

const base =
  "rounded-full px-4 py-3.5 font-heading font-semibold transition active:scale-[0.98] disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-[0px_10px_24px_rgba(244,166,210,0.5)]",
  secondary: "bg-button-inactive-bg text-button-inactive-text",
};

// Exported separately so components that can't render a plain <Button>
// (e.g. AddForm's SubmitButton, which needs useFormStatus from inside a
// <form> and renders its own <button>) can still reuse the exact classes.
export function buttonClass(variant: Variant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`.trim();
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: { variant?: Variant } & ComponentProps<"button">) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: { variant?: Variant } & ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
