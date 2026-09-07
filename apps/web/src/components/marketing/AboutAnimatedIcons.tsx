import type { ReactNode } from "react";

export type AboutIconVariant =
  | "spark"
  | "bolt"
  | "shield"
  | "catalog"
  | "chat"
  | "gamepad"
  | "gift"
  | "wallet"
  | "track"
  | "browse"
  | "pay"
  | "receive"
  | "story"
  | "belief"
  | "star"
  | "grid"
  | "route"
  | "check";

type AboutIconSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<AboutIconSize, string> = {
  xs: "about-icon-shell--xs",
  sm: "about-icon-shell--sm",
  md: "about-icon-shell--md",
  lg: "about-icon-shell--lg",
};

const WRAP_SIZE_CLASS: Record<AboutIconSize, string> = {
  xs: "about-icon-wrap--xs",
  sm: "about-icon-wrap--sm",
  md: "about-icon-wrap--md",
  lg: "about-icon-wrap--lg",
};

function IconPaths({ variant }: { variant: AboutIconVariant }) {
  switch (variant) {
    case "spark":
      return (
        <>
          <path
            className="about-icon-spark-ray"
            d="M12 3v3M12 18v3M3 12h3M18 12h3"
          />
          <path
            className="about-icon-spark-ray about-icon-spark-ray--diag"
            d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
          />
        </>
      );
    case "bolt":
      return (
        <path
          className="about-icon-bolt"
          strokeLinecap="round"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      );
    case "shield":
      return (
        <>
          <path
            className="about-icon-shield-body"
            strokeLinecap="round"
            d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"
          />
          <path
            className="about-icon-shield-check"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m9 12 2 2 4-4"
          />
        </>
      );
    case "catalog":
      return (
        <>
          <path className="about-icon-catalog-line" strokeLinecap="round" d="M4 6h16" />
          <path
            className="about-icon-catalog-line about-icon-catalog-line--2"
            strokeLinecap="round"
            d="M4 12h16"
          />
          <path
            className="about-icon-catalog-line about-icon-catalog-line--3"
            strokeLinecap="round"
            d="M4 18h7"
          />
        </>
      );
    case "chat":
      return (
        <>
          <path
            className="about-icon-chat-bubble"
            d="M7.5 4.25h9A4.75 4.75 0 0 1 21.25 9v4.2a4.75 4.75 0 0 1-4.75 4.75H12l-3.45 2.76a1 1 0 0 1-1.55-.8V18H7.5A4.75 4.75 0 0 1 2.75 13.2V9A4.75 4.75 0 0 1 7.5 4.25Z"
            fill="currentColor"
            stroke="none"
          />
          <circle className="about-icon-chat-dot about-icon-chat-dot--1" cx="8.6" cy="11.8" r="1.05" />
          <circle className="about-icon-chat-dot about-icon-chat-dot--2" cx="12" cy="11.8" r="1.05" />
          <circle className="about-icon-chat-dot about-icon-chat-dot--3" cx="15.4" cy="11.8" r="1.05" />
        </>
      );
    case "gamepad":
      return (
        <>
          <path
            className="about-icon-gamepad-body"
            strokeLinecap="round"
            d="M6 11h4M8 9v4M15 10h.01M18 12h.01"
          />
          <path
            className="about-icon-gamepad-body"
            strokeLinecap="round"
            d="M7 15h10a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4H9.5a6.5 6.5 0 0 0-5.8 3.6L4 12.5"
          />
        </>
      );
    case "gift":
      return (
        <>
          <path className="about-icon-gift-box" strokeLinecap="round" d="M20 12v8H4V12" />
          <path className="about-icon-gift-lid" strokeLinecap="round" d="M2 7h20v5H2z" />
          <path className="about-icon-gift-ribbon" strokeLinecap="round" d="M12 22V7" />
          <path
            className="about-icon-gift-bow"
            strokeLinecap="round"
            d="M12 7C12 4.5 10 3 8.5 4.5S7 9 12 7s3.5-2.5 2-4S12 4.5 12 7z"
          />
        </>
      );
    case "wallet":
      return (
        <>
          <path
            className="about-icon-wallet-body"
            strokeLinecap="round"
            d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H3z"
          />
          <path className="about-icon-wallet-flap" strokeLinecap="round" d="M3 7V6a2 2 0 0 1 2-2h11" />
          <circle className="about-icon-wallet-coin" cx="17" cy="13" r="1" fill="currentColor" />
        </>
      );
    case "track":
      return (
        <>
          <circle className="about-icon-track-ring" cx="12" cy="12" r="8" />
          <path className="about-icon-track-hand" strokeLinecap="round" d="M12 8v5l3 2" />
        </>
      );
    case "browse":
      return (
        <>
          <circle className="about-icon-browse-lens" cx="11" cy="11" r="6" />
          <path className="about-icon-browse-handle" strokeLinecap="round" d="m16 16 4 4" />
        </>
      );
    case "pay":
      return (
        <>
          <rect className="about-icon-pay-card" x="3" y="6" width="18" height="12" rx="2" />
          <path className="about-icon-pay-stripe" strokeLinecap="round" d="M3 10h18" />
          <path className="about-icon-pay-chip" strokeLinecap="round" d="M7 14h4" />
        </>
      );
    case "receive":
      return (
        <>
          <path
            className="about-icon-receive-tray"
            strokeLinecap="round"
            d="M4 14h16l-2 5H6l-2-5z"
          />
          <path
            className="about-icon-receive-arrow"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m12 3 0 9M8.5 8.5 12 12l3.5-3.5"
          />
        </>
      );
    case "story":
      return (
        <>
          <path className="about-icon-story-page" strokeLinecap="round" d="M6 4h9l3 3v13H6z" />
          <path className="about-icon-story-line" strokeLinecap="round" d="M9 10h6" />
          <path
            className="about-icon-story-line about-icon-story-line--2"
            strokeLinecap="round"
            d="M9 14h6"
          />
          <path
            className="about-icon-story-line about-icon-story-line--3"
            strokeLinecap="round"
            d="M9 18h4"
          />
        </>
      );
    case "belief":
      return (
        <>
          <path
            className="about-icon-belief-heart"
            d="M12 20s-6.5-4.2-8.5-8.2C1.8 8.4 4.6 5 8 6.4c1.7.7 3 2.2 4 3.6 1-1.4 2.3-2.9 4-3.6 3.4-1.4 6.2 2 3.5 5.8C18.5 15.8 12 20 12 20z"
            fill="currentColor"
            stroke="none"
          />
        </>
      );
    case "star":
      return (
        <path
          className="about-icon-star"
          strokeLinejoin="round"
          d="m12 3 2.2 4.8 5.3.7-3.8 3.6.9 5.2L12 15.8 7.4 17.3l.9-5.2-3.8-3.6 5.3-.7L12 3z"
        />
      );
    case "grid":
      return (
        <>
          <rect className="about-icon-grid-cell" x="4" y="4" width="6" height="6" rx="1.2" />
          <rect
            className="about-icon-grid-cell about-icon-grid-cell--2"
            x="14"
            y="4"
            width="6"
            height="6"
            rx="1.2"
          />
          <rect
            className="about-icon-grid-cell about-icon-grid-cell--3"
            x="4"
            y="14"
            width="6"
            height="6"
            rx="1.2"
          />
          <rect
            className="about-icon-grid-cell about-icon-grid-cell--4"
            x="14"
            y="14"
            width="6"
            height="6"
            rx="1.2"
          />
        </>
      );
    case "route":
      return (
        <>
          <circle className="about-icon-route-node" cx="6" cy="18" r="2" />
          <circle className="about-icon-route-node about-icon-route-node--2" cx="18" cy="6" r="2" />
          <path
            className="about-icon-route-path"
            strokeLinecap="round"
            d="M8 16c3-6 5-8 10-10"
          />
        </>
      );
    case "check":
      return (
        <path
          className="about-icon-check"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m5 12 4 4L19 6"
        />
      );
    default:
      return null;
  }
}

function IconSvg({
  variant,
  className,
}: {
  variant: AboutIconVariant;
  className?: string;
}) {
  const isFilled = variant === "chat" || variant === "belief";
  return (
    <svg
      viewBox="0 0 24 24"
      className={["about-icon-svg", `about-icon-svg--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      fill={isFilled ? "currentColor" : "none"}
      stroke={isFilled ? "none" : "currentColor"}
      strokeWidth={isFilled ? undefined : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <IconPaths variant={variant} />
    </svg>
  );
}

export function AboutAnimatedIcon({
  variant,
  size = "md",
  withRing = true,
  className = "",
}: {
  variant: AboutIconVariant;
  size?: AboutIconSize;
  withRing?: boolean;
  className?: string;
}) {
  const shell = (
    <span className={["about-icon-shell", SIZE_CLASS[size], className].filter(Boolean).join(" ")}>
      <IconSvg variant={variant} />
    </span>
  );

  if (!withRing || size === "xs") {
    return shell;
  }

  return (
    <div className={["about-icon-wrap", WRAP_SIZE_CLASS[size], className].filter(Boolean).join(" ")}>
      <span className="about-icon-ring" aria-hidden />
      {shell}
    </div>
  );
}

export function AboutAnimatedStoreArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={["about-store-art", className].filter(Boolean).join(" ")}
      fill="none"
      aria-hidden
    >
      <rect
        className="about-store-art-bag"
        x="22"
        y="34"
        width="76"
        height="52"
        rx="8"
        fill="rgb(var(--brand))"
        opacity="0.9"
      />
      <path
        className="about-store-art-line"
        d="M22 42h76"
        stroke="rgb(var(--bg-elevated))"
        strokeWidth="2"
        opacity="0.35"
      />
      <rect
        className="about-store-art-tile about-store-art-tile--1"
        x="30"
        y="50"
        width="28"
        height="28"
        rx="5"
        fill="rgb(var(--bg-elevated))"
      />
      <rect
        className="about-store-art-tile about-store-art-tile--2"
        x="62"
        y="50"
        width="28"
        height="12"
        rx="4"
        fill="rgb(var(--bg-elevated))"
      />
      <rect
        className="about-store-art-tile about-store-art-tile--3"
        x="62"
        y="66"
        width="28"
        height="12"
        rx="4"
        fill="rgb(var(--bg-elevated))"
        opacity="0.85"
      />
      <path
        className="about-store-art-handle"
        d="M40 24 60 14l20 10"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="about-store-art-knob" cx="44" cy="24" r="4" fill="rgb(var(--brand))" />
      <circle
        className="about-store-art-knob about-store-art-knob--2"
        cx="76"
        cy="24"
        r="4"
        fill="rgb(var(--brand))"
      />
      <path
        className="about-store-art-sparkle"
        d="M97 12l1.7 4.3 4.3 1.7-4.3 1.7L97 24l-1.7-4.3L91 18l4.3-1.7L97 12Z"
        fill="rgb(var(--brand))"
        opacity="0.9"
      />
      <circle
        className="about-store-art-sparkle about-store-art-sparkle--2"
        cx="14"
        cy="30"
        r="2.4"
        fill="rgb(var(--brand))"
        opacity="0.6"
      />
    </svg>
  );
}

export function AboutBeliefIcon() {
  return <AboutAnimatedIcon variant="check" size="xs" withRing={false} />;
}

export function AboutSectionBadgeIcon({ variant }: { variant: AboutIconVariant }) {
  return <AboutAnimatedIcon variant={variant} size="xs" withRing={false} />;
}

export function AboutFeatureIcon({ variant }: { variant: AboutIconVariant }) {
  return <AboutAnimatedIcon variant={variant} size="md" withRing />;
}

export function AboutOfferingIcon({ variant }: { variant: AboutIconVariant }) {
  return <AboutAnimatedIcon variant={variant} size="sm" withRing />;
}

export function AboutStepIcon({ variant }: { variant: AboutIconVariant }) {
  return <AboutAnimatedIcon variant={variant} size="md" withRing />;
}

export function AboutCtaIcon() {
  return <AboutAnimatedIcon variant="spark" size="lg" withRing />;
}

export function AboutHeroBadgeIcon() {
  return <AboutAnimatedIcon variant="spark" size="xs" withRing={false} />;
}

export function aboutIconNode(variant: AboutIconVariant, size: AboutIconSize = "md"): ReactNode {
  return <AboutAnimatedIcon variant={variant} size={size} withRing={size !== "xs"} />;
}
