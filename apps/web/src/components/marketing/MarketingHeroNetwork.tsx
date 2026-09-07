/** Premium tech network hero backdrop — brand-matched aurora, hub rings, glass nodes. */
export function MarketingHeroNetwork() {
  return (
    <svg
      className="marketing-hero__network"
      viewBox="0 0 420 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <filter
          id="mkt-hero-brand-glow"
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="mkt-hero-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <linearGradient id="mkt-hero-line-brand" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity="0.15" />
          <stop offset="45%" stopColor="rgb(var(--brand))" stopOpacity="1" />
          <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="mkt-hero-cube-face" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity="0.14" />
          <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity="0.02" />
        </linearGradient>
        <radialGradient id="mkt-hero-orb-a" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity="0.34" />
          <stop offset="55%" stopColor="rgb(var(--brand))" stopOpacity="0.1" />
          <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mkt-hero-orb-b" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(var(--gradient-to))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(var(--gradient-to))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mkt-hero-aurora" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity="0.22" />
          <stop offset="40%" stopColor="rgb(var(--gradient-to))" stopOpacity="0.1" />
          <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity="0" />
        </radialGradient>
        <pattern
          id="mkt-hero-grid"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M28 0H0V28"
            stroke="rgb(var(--brand))"
            strokeOpacity="0.07"
            strokeWidth="0.6"
            fill="none"
          />
        </pattern>
      </defs>

      {/* Soft grid + aurora wash */}
      <rect
        className="marketing-hero__grid"
        x="80"
        y="0"
        width="340"
        height="280"
        fill="url(#mkt-hero-grid)"
      />
      <ellipse
        className="marketing-hero__aurora"
        cx="230"
        cy="128"
        rx="150"
        ry="110"
        fill="url(#mkt-hero-aurora)"
        filter="url(#mkt-hero-soft-glow)"
      />

      {/* Depth orbs */}
      <circle
        className="marketing-hero__orb marketing-hero__orb--a"
        cx="318"
        cy="188"
        r="72"
        fill="url(#mkt-hero-orb-a)"
      />
      <circle
        className="marketing-hero__orb marketing-hero__orb--b"
        cx="278"
        cy="52"
        r="54"
        fill="url(#mkt-hero-orb-b)"
      />
      <circle
        className="marketing-hero__orb marketing-hero__orb--c"
        cx="368"
        cy="118"
        r="40"
        fill="url(#mkt-hero-orb-b)"
      />

      {/* Hub pulse rings */}
      <g className="marketing-hero__hub">
        <circle className="marketing-hero__hub-ring marketing-hero__hub-ring--1" cx="220" cy="120" r="58" />
        <circle className="marketing-hero__hub-ring marketing-hero__hub-ring--2" cx="220" cy="120" r="78" />
        <circle className="marketing-hero__hub-ring marketing-hero__hub-ring--3" cx="220" cy="120" r="98" />
      </g>

      {/* Network mesh */}
      <g className="marketing-hero__mesh">
        <path className="marketing-hero__mesh-line" d="M62 54 L188 102 L220 84" />
        <path className="marketing-hero__mesh-line" d="M54 216 L188 138 L220 156" />
        <path
          className="marketing-hero__mesh-line marketing-hero__mesh-line--dash"
          d="M62 54 L368 222"
        />
        <path
          className="marketing-hero__mesh-line marketing-hero__mesh-line--dash"
          d="M54 216 L350 50"
        />
        <path className="marketing-hero__mesh-line" d="M350 50 L252 102 L220 84" />
        <path className="marketing-hero__mesh-line" d="M368 222 L252 138 L220 156" />
        <path
          className="marketing-hero__mesh-line marketing-hero__mesh-line--faint"
          d="M130 40 L220 84 L310 36"
        />
        <path
          className="marketing-hero__mesh-line marketing-hero__mesh-line--faint"
          d="M100 200 L220 156 L340 240"
        />
      </g>

      {/* Primary brand connectors */}
      <line
        className="marketing-hero__brand-line"
        x1="252"
        y1="102"
        x2="350"
        y2="50"
        stroke="url(#mkt-hero-line-brand)"
        filter="url(#mkt-hero-brand-glow)"
      />
      <line
        className="marketing-hero__brand-line marketing-hero__brand-line--secondary"
        x1="188"
        y1="138"
        x2="54"
        y2="216"
        filter="url(#mkt-hero-brand-glow)"
      />
      <line
        className="marketing-hero__brand-line marketing-hero__brand-line--pulse"
        x1="252"
        y1="102"
        x2="350"
        y2="50"
        filter="url(#mkt-hero-brand-glow)"
      />

      {/* Data-flow paths */}
      <path className="marketing-hero__flow-line" d="M220 84 L62 54" />
      <path
        className="marketing-hero__flow-line marketing-hero__flow-line--delay"
        d="M188 138 L54 216"
      />
      <path
        className="marketing-hero__flow-line marketing-hero__flow-line--delay-2"
        d="M220 156 L368 222"
      />
      <path
        className="marketing-hero__flow-line marketing-hero__flow-line--accent"
        d="M220 120 L350 50"
      />

      {/* Wireframe cube hub */}
      <g className="marketing-hero__cube">
        <path
          className="marketing-hero__cube-face"
          d="M220 84 L188 102 L220 120 L252 102 Z"
        />
        <path
          className="marketing-hero__cube-face marketing-hero__cube-face--dim"
          d="M188 102 L188 138 L220 156 L220 120 Z"
        />
        <path
          className="marketing-hero__cube-edge marketing-hero__cube-edge--bright"
          d="M220 84 L188 102 L220 120 L252 102 Z"
        />
        <path
          className="marketing-hero__cube-edge"
          d="M188 102 L188 138 L220 156 L220 120 Z"
        />
        <path
          className="marketing-hero__cube-edge marketing-hero__cube-edge--bright"
          d="M252 102 L252 138 L220 156 L220 120 Z"
        />
        <line
          className="marketing-hero__cube-edge marketing-hero__cube-edge--ghost"
          x1="220"
          y1="84"
          x2="220"
          y2="120"
        />
        <line
          className="marketing-hero__cube-edge marketing-hero__cube-edge--ghost"
          x1="188"
          y1="102"
          x2="252"
          y2="102"
        />

        <circle className="marketing-hero__vertex marketing-hero__vertex--brand" cx="220" cy="84" r="4" />
        <circle className="marketing-hero__vertex" cx="188" cy="102" r="3.2" />
        <circle className="marketing-hero__vertex marketing-hero__vertex--brand" cx="252" cy="102" r="4" />
        <circle className="marketing-hero__vertex" cx="188" cy="138" r="3.2" />
        <circle className="marketing-hero__vertex marketing-hero__vertex--accent" cx="252" cy="138" r="3.2" />
        <circle className="marketing-hero__vertex" cx="220" cy="156" r="3.2" />
        <circle className="marketing-hero__vertex marketing-hero__vertex--brand" cx="220" cy="120" r="2.8" />
      </g>

      {/* Glass icon nodes */}
      <g className="marketing-hero__node marketing-hero__node--1">
        <circle className="marketing-hero__node-pulse" cx="62" cy="54" r="30" />
        <circle className="marketing-hero__node-ring" cx="62" cy="54" r="24" />
        <circle className="marketing-hero__node-core" cx="62" cy="54" r="18" />
        <g className="marketing-hero__node-icon" transform="translate(62 54)">
          <path d="M-8 -2h16M-8 2h16M-8 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="-4" cy="-2" r="2" fill="currentColor" stroke="none" />
          <circle cx="4" cy="2" r="2" fill="currentColor" stroke="none" />
          <circle cx="-1" cy="6" r="2" fill="currentColor" stroke="none" />
        </g>
      </g>

      <g className="marketing-hero__node marketing-hero__node--2">
        <circle className="marketing-hero__node-pulse" cx="54" cy="216" r="30" />
        <circle className="marketing-hero__node-ring" cx="54" cy="216" r="24" />
        <circle className="marketing-hero__node-core" cx="54" cy="216" r="18" />
        <g className="marketing-hero__node-icon" transform="translate(54 216)">
          <path
            d="M-7 -6c-3 0-5.5 2.5-5.5 5.5 0 3.5 2.5 6.5 5.5 8.5 3-2 5.5-5 5.5-8.5C3 -3.5 0.5 -6 -2 -6"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M-4 -1.5c0 1.5 1 2.5 2 2.5s2-1 2-2.5M-5.5 2c1.2 1 2.8 1.5 4.5 1.5"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </g>
      </g>

      <g className="marketing-hero__node marketing-hero__node--3">
        <circle className="marketing-hero__node-pulse" cx="350" cy="50" r="30" />
        <circle className="marketing-hero__node-ring" cx="350" cy="50" r="24" />
        <circle className="marketing-hero__node-core" cx="350" cy="50" r="18" />
        <g className="marketing-hero__node-icon" transform="translate(350 50)">
          <circle cx="0" cy="0" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="-5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="-7" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" />
          <path d="M4 -3.5l3-1.5M-4 3.5l-3 1.5" stroke="currentColor" strokeWidth="1.3" />
        </g>
      </g>

      <g className="marketing-hero__node marketing-hero__node--4">
        <circle className="marketing-hero__node-pulse" cx="368" cy="222" r="30" />
        <circle className="marketing-hero__node-ring" cx="368" cy="222" r="24" />
        <circle className="marketing-hero__node-core" cx="368" cy="222" r="18" />
        <g className="marketing-hero__node-icon" transform="translate(368 222)">
          <path
            d="M0 -10v6M0 -4l-6 10h12L0 -4Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M-8 12c0-2 3.5-3.5 8-3.5s8 1.5 8 3.5" stroke="currentColor" strokeWidth="1.4" />
        </g>
      </g>

      {/* Spark field */}
      <circle className="marketing-hero__spark marketing-hero__spark--1" cx="138" cy="36" r="1.6" />
      <circle className="marketing-hero__spark marketing-hero__spark--2" cx="302" cy="92" r="1.3" />
      <circle className="marketing-hero__spark marketing-hero__spark--3" cx="172" cy="198" r="1.5" />
      <circle className="marketing-hero__spark marketing-hero__spark--4" cx="328" cy="168" r="1.1" />
      <circle className="marketing-hero__spark marketing-hero__spark--5" cx="102" cy="132" r="1.2" />
      <circle className="marketing-hero__spark marketing-hero__spark--6" cx="388" cy="158" r="1.4" />
      <circle className="marketing-hero__spark marketing-hero__spark--7" cx="248" cy="28" r="1" />
      <circle className="marketing-hero__spark marketing-hero__spark--8" cx="196" cy="248" r="1.2" />
    </svg>
  );
}
