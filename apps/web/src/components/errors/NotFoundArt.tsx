export function NotFoundArt({ className = "" }: { className?: string }) {
  return (
    <div
      className={`not-found-art mx-auto mb-6 ${className}`.trim()}
      aria-hidden
    >
      <div className="not-found-art__glow" />
      <div className="not-found-art__orbit not-found-art__orbit--1" />
      <div className="not-found-art__orbit not-found-art__orbit--2" />

      <svg
        viewBox="0 0 200 160"
        className="not-found-art__svg"
        fill="none"
      >
        <defs>
          <linearGradient id="not-found-page-fill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--bg-elevated))" />
            <stop offset="100%" stopColor="rgb(var(--bg-muted))" />
          </linearGradient>
          <linearGradient id="not-found-brand-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        <rect
          className="not-found-art__page-shadow"
          x="34"
          y="30"
          width="108"
          height="88"
          rx="14"
          fill="rgb(var(--brand) / 0.08)"
        />

        <rect
          className="not-found-art__page"
          x="30"
          y="24"
          width="108"
          height="88"
          rx="14"
          fill="url(#not-found-page-fill)"
          stroke="rgb(var(--border))"
          strokeWidth="2"
        />

        <rect
          className="not-found-art__page-bar"
          x="30"
          y="24"
          width="108"
          height="22"
          rx="14"
          fill="rgb(var(--brand) / 0.12)"
        />
        <rect x="30" y="38" width="108" height="8" fill="url(#not-found-page-fill)" />

        <circle cx="44" cy="35" r="3.5" fill="rgb(var(--brand) / 0.45)" />
        <circle cx="56" cy="35" r="3.5" fill="rgb(var(--brand) / 0.3)" />
        <circle cx="68" cy="35" r="3.5" fill="rgb(var(--brand) / 0.2)" />

        <path
          className="not-found-art__line not-found-art__line--1"
          d="M48 58h72"
          stroke="rgb(var(--foreground-muted))"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path
          className="not-found-art__line not-found-art__line--2"
          d="M48 72h54"
          stroke="rgb(var(--foreground-muted))"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path
          className="not-found-art__line not-found-art__line--3"
          d="M48 86h36"
          stroke="rgb(var(--foreground-muted))"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.25"
        />

        <path
          className="not-found-art__broken"
          d="M88 52l18 18M106 52L88 70"
          stroke="rgb(var(--brand))"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <g className="not-found-art__search">
          <circle
            cx="142"
            cy="96"
            r="24"
            fill="rgb(var(--brand) / 0.1)"
            stroke="rgb(var(--brand) / 0.35)"
            strokeWidth="2"
          />
          <circle
            cx="142"
            cy="96"
            r="13"
            stroke="url(#not-found-brand-glow)"
            strokeWidth="4"
          />
          <path
            d="M158 112l20 20"
            stroke="rgb(var(--brand))"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>

        <path
          className="not-found-art__sparkle not-found-art__sparkle--1"
          d="M24 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"
          fill="rgb(var(--brand))"
        />
        <circle
          className="not-found-art__sparkle not-found-art__sparkle--2"
          cx="176"
          cy="34"
          r="3"
          fill="rgb(var(--brand))"
        />
        <circle
          className="not-found-art__sparkle not-found-art__sparkle--3"
          cx="18"
          cy="118"
          r="2.5"
          fill="rgb(var(--brand))"
          opacity="0.7"
        />
      </svg>

      <span className="not-found-art__badge">404</span>
    </div>
  );
}
