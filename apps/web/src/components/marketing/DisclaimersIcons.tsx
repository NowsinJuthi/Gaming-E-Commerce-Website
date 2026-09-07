import type { ReactNode } from "react";

export type DisclaimersIconVariant =
  | "intro"
  | "general"
  | "external"
  | "gift"
  | "topup"
  | "consent"
  | "update"
  | "contact";

function DisclaimersIconSvg({
  variant,
  className,
}: {
  variant: DisclaimersIconVariant;
  className?: string;
}) {
  const cls = [
    "refund-policy-icon-svg",
    `disclaimers-icon-svg--${variant}`,
    className,
  ]
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
          <path {...stroke} strokeWidth={1.5} d="M10 11h6M10 14h5M10 17h4" />
        </svg>
      );
    case "general":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path className="refund-policy-icon-refund-coin" {...stroke} d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
          <path {...stroke} strokeWidth={1.5} d="M12 9v5M12 8h.01" />
        </svg>
      );
    case "external":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M10 14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
          <path {...stroke} d="M14 10h4v10H10v-4" />
        </svg>
      );
    case "gift":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M4 10h16v10H4zM12 10V4M8 6h8a2 2 0 0 1 0 4H8a2 2 0 0 1 0-4z" />
          <path {...stroke} strokeWidth={1.5} d="M12 6v4" />
        </svg>
      );
    case "topup":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path {...stroke} d="M6 12h12M12 6v12" />
          <rect x="4" y="4" width="16" height="16" rx="3" {...stroke} />
        </svg>
      );
    case "consent":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" {...stroke} />
          <path {...stroke} d="M9 12l2 2 4-4" />
        </svg>
      );
    case "update":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path className="refund-policy-icon-refund-arrow" {...stroke} d="M12 6v6l3 2" />
          <circle className="refund-policy-icon-clock-face" cx="12" cy="12" r="8" {...stroke} />
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

export function DisclaimersIcon({
  variant,
  size = "md",
}: {
  variant: DisclaimersIconVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={`refund-policy-icon-wrap refund-policy-icon-wrap--${size}`}>
      <span className="refund-policy-icon-ring" aria-hidden />
      <span className={`refund-policy-icon-shell refund-policy-icon-shell--${size}`}>
        <DisclaimersIconSvg variant={variant} />
      </span>
    </div>
  );
}

export function DisclaimersHeroArt({ className }: { className?: string }) {
  return (
    <div className={["refund-policy-hero-art", className].filter(Boolean).join(" ")} aria-hidden>
      <span className="refund-policy-hero-orbit refund-policy-hero-orbit--1" />
      <span className="refund-policy-hero-orbit refund-policy-hero-orbit--2" />
      <DisclaimersIcon variant="intro" size="lg" />
    </div>
  );
}

export function disclaimersIconNode(
  variant: DisclaimersIconVariant,
  size: "sm" | "md" | "lg" = "md",
): ReactNode {
  return <DisclaimersIcon variant={variant} size={size} />;
}
