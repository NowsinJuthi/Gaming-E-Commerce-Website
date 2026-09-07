"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type Variant = "primary" | "ghost" | "danger";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "panel-3d-btn",
  ghost: "panel-3d-btn-ghost",
  danger: "panel-3d-btn-ghost panel-3d-btn--danger",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: IconComponent;
  loading?: boolean;
  pulse?: boolean;
  showArrow?: boolean;
  children: ReactNode;
};

export function ActionButton({
  variant = "primary",
  icon: Icon,
  loading = false,
  pulse = false,
  showArrow,
  children,
  className = "",
  disabled,
  ...props
}: Props) {
  const isPrimary = variant === "primary";
  const arrow = showArrow ?? isPrimary;

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={[
        VARIANT_CLASS[variant],
        pulse ? "panel-3d-btn--pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? (
        <span className="panel-3d-btn-spinner" aria-hidden />
      ) : Icon ? (
        <span className="panel-3d-btn-icon" aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <span className="panel-3d-btn-label">{children}</span>
      {arrow && !loading ? (
        <span className="panel-3d-btn-arrow" aria-hidden>
          →
        </span>
      ) : null}
    </button>
  );
}
