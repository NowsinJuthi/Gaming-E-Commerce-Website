import type { ReactNode } from "react";

export type RefundPolicyIconVariant =
  | "overview"
  | "refund"
  | "clock"
  | "sale"
  | "exchange"
  | "gift"
  | "shipping"
  | "help";

function RefundPolicySvg({
  variant,
  className,
}: {
  variant: RefundPolicyIconVariant;
  className?: string;
}) {
  const cls = ["refund-policy-icon-svg", `refund-policy-icon-svg--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  switch (variant) {
    case "overview":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            className="refund-policy-icon-doc"
            d="M7 3h7l3 3v15H7z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            className="refund-policy-icon-doc-line"
            d="M10 11h6M10 14h6M10 17h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle
            className="refund-policy-icon-doc-dot"
            cx="17"
            cy="7"
            r="2.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      );
    case "refund":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            className="refund-policy-icon-refund-ring"
            d="M12 4v3M12 17v3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            className="refund-policy-icon-refund-arrow"
            d="M7 9H5a4 4 0 1 0 4 4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="refund-policy-icon-refund-arrow refund-policy-icon-refund-arrow--2"
            d="M17 15h2a4 4 0 0 0-4-4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            className="refund-policy-icon-refund-coin"
            cx="12"
            cy="12"
            r="3.2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
    case "clock":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle
            className="refund-policy-icon-clock-face"
            cx="12"
            cy="12"
            r="8"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            className="refund-policy-icon-clock-hand"
            d="M12 8v5l3 2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "sale":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            className="refund-policy-icon-tag"
            d="M20 12l-8 8-9-9V4h7z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle
            className="refund-policy-icon-tag-hole"
            cx="8"
            cy="8"
            r="1.4"
            fill="currentColor"
          />
        </svg>
      );
    case "exchange":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            className="refund-policy-icon-swap"
            d="M7 7h11M7 7l3-3M7 7l3 3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="refund-policy-icon-swap refund-policy-icon-swap--2"
            d="M17 17H6M17 17l-3 3M17 17l-3-3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "gift":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            className="refund-policy-icon-gift-lid"
            d="M3 9h18v4H3z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            className="refund-policy-icon-gift-box"
            d="M5 13v8h5v-8M14 13v8h5v-8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            className="refund-policy-icon-gift-bow"
            d="M12 9V4M8.5 6.5a2.5 2.5 0 0 1 0-3.5M15.5 6.5a2.5 2.5 0 0 0 0-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "shipping":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            className="refund-policy-icon-truck"
            d="M3 8h11v8H3zM14 11h4l2 3v2h-6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle
            className="refund-policy-icon-truck-wheel"
            cx="7"
            cy="17"
            r="1.8"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle
            className="refund-policy-icon-truck-wheel refund-policy-icon-truck-wheel--2"
            cx="17"
            cy="17"
            r="1.8"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "help":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            className="refund-policy-icon-mail"
            d="M4 6h16v12H4z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            className="refund-policy-icon-mail-flap"
            d="m4 7 8 6 8-6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function RefundPolicyIcon({
  variant,
  size = "md",
}: {
  variant: RefundPolicyIconVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={`refund-policy-icon-wrap refund-policy-icon-wrap--${size}`}>
      <span className="refund-policy-icon-ring" aria-hidden />
      <span className={`refund-policy-icon-shell refund-policy-icon-shell--${size}`}>
        <RefundPolicySvg variant={variant} />
      </span>
    </div>
  );
}

export function RefundPolicyHeroArt({ className }: { className?: string }) {
  return (
    <div className={["refund-policy-hero-art", className].filter(Boolean).join(" ")} aria-hidden>
      <span className="refund-policy-hero-orbit refund-policy-hero-orbit--1" />
      <span className="refund-policy-hero-orbit refund-policy-hero-orbit--2" />
      <RefundPolicyIcon variant="refund" size="lg" />
    </div>
  );
}

export function refundPolicyIconNode(
  variant: RefundPolicyIconVariant,
  size: "sm" | "md" | "lg" = "md",
): ReactNode {
  return <RefundPolicyIcon variant={variant} size={size} />;
}
