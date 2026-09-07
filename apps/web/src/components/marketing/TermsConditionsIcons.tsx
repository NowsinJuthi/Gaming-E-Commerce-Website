import type { ReactNode } from "react";

export type TermsIconVariant =
  | "intro"
  | "mail"
  | "cart"
  | "trophy"
  | "subscription"
  | "trial"
  | "fees"
  | "refund"
  | "content"
  | "analytics"
  | "shield"
  | "account"
  | "feedback"
  | "warranty"
  | "contact";

function TermsIconSvg({
  variant,
  className,
}: {
  variant: TermsIconVariant;
  className?: string;
}) {
  const cls = ["refund-policy-icon-svg", `terms-icon-svg--${variant}`, className]
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
          <path {...stroke} d="M7 3h7l3 3v15H7z" />
          <path {...stroke} strokeWidth={1.5} d="M10 11h6M10 14h5" />
        </svg>
      );
    case "mail":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M4 6h16v12H4z" />
          <path className="refund-policy-icon-mail-flap" {...stroke} strokeWidth={1.5} d="m4 7 8 6 8-6" />
        </svg>
      );
    case "cart":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M4 6h2l2 10h10l2-8H8" />
          <circle cx="10" cy="19" r="1.5" fill="currentColor" />
          <circle cx="17" cy="19" r="1.5" fill="currentColor" />
        </svg>
      );
    case "trophy":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M8 4h8v5a4 4 0 0 1-8 0zM6 6H4v1a2 2 0 0 0 2 2M18 6h2v1a2 2 0 0 1-2 2" />
          <path {...stroke} d="M12 13v3M9 20h6M10 16h4" />
        </svg>
      );
    case "subscription":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M4 7h16v10H4z" />
          <path className="refund-policy-icon-refund-arrow" {...stroke} d="M8 12h8" />
          <path {...stroke} d="M12 4v3M12 17v3" />
        </svg>
      );
    case "trial":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="refund-policy-icon-clock-face" cx="12" cy="12" r="8" {...stroke} />
          <path className="refund-policy-icon-clock-hand" {...stroke} d="M12 8v5l3 2" />
        </svg>
      );
    case "fees":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M12 3v18" />
          <path {...stroke} d="M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" />
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
    case "content":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M5 5h14v14H5z" />
          <path {...stroke} strokeWidth={1.5} d="M8 9h8M8 12h8M8 15h5" />
        </svg>
      );
    case "analytics":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M4 19V5M4 19h16" />
          <path {...stroke} d="M8 15V9M12 17V7M16 13v-2" />
        </svg>
      );
    case "shield":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path className="refund-policy-icon-refund-coin" {...stroke} d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
          <path {...stroke} strokeWidth={1.5} d="M9 12l2 2 4-4" />
        </svg>
      );
    case "account":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="8" r="3.5" {...stroke} />
          <path {...stroke} d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      );
    case "feedback":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M4 6h16v10H8l-4 4z" />
          <path {...stroke} strokeWidth={1.5} d="M8 10h8M8 13h5" />
        </svg>
      );
    case "warranty":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M12 4l8 4v5c0 4.5-3.5 7.5-8 8-4.5-.5-8-3.5-8-8V8z" />
          <path {...stroke} strokeWidth={1.5} d="M12 8v5" />
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

export function TermsIcon({
  variant,
  size = "md",
}: {
  variant: TermsIconVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={`refund-policy-icon-wrap refund-policy-icon-wrap--${size}`}>
      <span className="refund-policy-icon-ring" aria-hidden />
      <span className={`refund-policy-icon-shell refund-policy-icon-shell--${size}`}>
        <TermsIconSvg variant={variant} />
      </span>
    </div>
  );
}

export function TermsHeroArt({ className }: { className?: string }) {
  return (
    <div className={["refund-policy-hero-art", className].filter(Boolean).join(" ")} aria-hidden>
      <span className="refund-policy-hero-orbit refund-policy-hero-orbit--1" />
      <span className="refund-policy-hero-orbit refund-policy-hero-orbit--2" />
      <TermsIcon variant="intro" size="lg" />
    </div>
  );
}

export function termsIconNode(
  variant: TermsIconVariant,
  size: "sm" | "md" | "lg" = "md",
): ReactNode {
  return <TermsIcon variant={variant} size={size} />;
}
