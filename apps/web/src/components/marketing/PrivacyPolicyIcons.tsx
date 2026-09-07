import type { ReactNode } from "react";

export type PrivacyIconVariant =
  | "intro"
  | "consent"
  | "collect"
  | "overview"
  | "excluded"
  | "refund"
  | "clock"
  | "sale"
  | "shipping"
  | "contact";

function PrivacyIconSvg({
  variant,
  className,
}: {
  variant: PrivacyIconVariant;
  className?: string;
}) {
  const cls = ["refund-policy-icon-svg", `privacy-icon-svg--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (variant) {
    case "intro":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path className="refund-policy-icon-refund-coin" {...stroke} d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
          <path {...stroke} strokeWidth={1.5} d="M12 10v4M12 8h.01" />
        </svg>
      );
    case "consent":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="8" {...stroke} />
        </svg>
      );
    case "collect":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M4 6h16v12H4z" />
          <path {...stroke} strokeWidth={1.5} d="M8 10h8M8 13h6M8 16h4" />
        </svg>
      );
    case "overview":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" {...stroke} />
          <path {...stroke} strokeWidth={1.5} d="M12 8v5M12 16h.01" />
        </svg>
      );
    case "excluded":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" {...stroke} />
          <path {...stroke} d="M8 8l8 8" />
        </svg>
      );
    case "refund":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path className="refund-policy-icon-refund-arrow" {...stroke} d="M7 9H5a4 4 0 1 0 4 4" />
          <path className="refund-policy-icon-refund-arrow refund-policy-icon-refund-arrow--2" {...stroke} d="M17 15h2a4 4 0 0 0-4-4" />
          <circle className="refund-policy-icon-refund-coin" cx="12" cy="12" r="3.2" {...stroke} />
        </svg>
      );
    case "clock":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="refund-policy-icon-clock-face" cx="12" cy="12" r="8" {...stroke} />
          <path className="refund-policy-icon-clock-hand" {...stroke} d="M12 8v5l3 2" />
        </svg>
      );
    case "sale":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M4 9l4-5h8l4 5v10H4z" />
          <path {...stroke} strokeWidth={1.5} d="M9 14h6" />
        </svg>
      );
    case "shipping":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="1.5" fill="currentColor" />
          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );
    case "contact":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M4 6h16v12H4z" />
          <path className="refund-policy-icon-mail-flap" {...stroke} strokeWidth={1.5} d="m4 7 8 6 8-6" />
        </svg>
      );
    default:
      return null;
  }
}

export function PrivacyIcon({
  variant,
  size = "md",
}: {
  variant: PrivacyIconVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={`refund-policy-icon-wrap refund-policy-icon-wrap--${size}`}>
      <span className="refund-policy-icon-ring" aria-hidden />
      <span className={`refund-policy-icon-shell refund-policy-icon-shell--${size}`}>
        <PrivacyIconSvg variant={variant} />
      </span>
    </div>
  );
}

export function PrivacyHeroArt({ className }: { className?: string }) {
  return (
    <div className={["refund-policy-hero-art", className].filter(Boolean).join(" ")} aria-hidden>
      <span className="refund-policy-hero-orbit refund-policy-hero-orbit--1" />
      <span className="refund-policy-hero-orbit refund-policy-hero-orbit--2" />
      <PrivacyIcon variant="intro" size="lg" />
    </div>
  );
}

export function privacyIconNode(
  variant: PrivacyIconVariant,
  size: "sm" | "md" | "lg" = "md",
): ReactNode {
  return <PrivacyIcon variant={variant} size={size} />;
}
