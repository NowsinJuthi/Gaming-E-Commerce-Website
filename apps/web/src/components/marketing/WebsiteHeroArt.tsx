export function WebsiteHeroArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={`website-hero-art ${className}`.trim()}
      fill="none"
      aria-hidden
    >
      <ellipse
        className="website-hero-art__shadow"
        cx="100"
        cy="142"
        rx="62"
        ry="7"
        fill="rgb(var(--brand) / 0.16)"
      />
      <rect
        className="website-hero-art__monitor"
        x="34"
        y="28"
        width="112"
        height="78"
        rx="10"
        fill="rgb(var(--bg-elevated))"
        stroke="rgb(var(--brand))"
        strokeWidth="2.5"
        opacity="0.95"
      />
      <path
        className="website-hero-art__monitor-bar"
        d="M34 44h112"
        stroke="rgb(var(--brand))"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle className="website-hero-art__dot website-hero-art__dot--1" cx="48" cy="36" r="2.5" fill="rgb(var(--brand))" />
      <circle className="website-hero-art__dot website-hero-art__dot--2" cx="56" cy="36" r="2.5" fill="rgb(var(--brand))" />
      <rect
        className="website-hero-art__screen-block website-hero-art__screen-block--1"
        x="48"
        y="56"
        width="36"
        height="28"
        rx="4"
        fill="rgb(var(--brand) / 0.2)"
      />
      <path
        className="website-hero-art__screen-line website-hero-art__screen-line--1"
        d="M92 60h38M92 70h28M92 80h34"
        stroke="rgb(var(--brand))"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="website-hero-art__code"
        d="M18 72 8 82l10 10M182 72l10 10-10 10"
        stroke="rgb(var(--brand))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="website-hero-art__stand"
        d="M78 106h44M100 106v14M86 120h28"
        stroke="rgb(var(--brand))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        className="website-hero-art__globe"
        cx="156"
        cy="42"
        r="18"
        fill="rgb(var(--brand) / 0.12)"
        stroke="rgb(var(--brand) / 0.5)"
        strokeWidth="2"
      />
      <path
        className="website-hero-art__globe-line"
        d="M144 42h24M156 30v24"
        stroke="rgb(var(--brand))"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle className="website-hero-art__spark website-hero-art__spark--1" cx="24" cy="38" r="4" fill="rgb(var(--brand))" />
      <path
        className="website-hero-art__spark website-hero-art__spark--2"
        d="M172 108l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z"
        fill="rgb(var(--brand))"
      />
      <circle className="website-hero-art__orbit" cx="168" cy="88" r="5" fill="rgb(var(--brand))" />
    </svg>
  );
}
