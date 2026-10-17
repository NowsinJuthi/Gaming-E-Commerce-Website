import styles from "./login.module.css";

const orbits = [
  { radius: 78, dots: 5, duration: 18 },
  { radius: 112, dots: 7, duration: 26 },
  { radius: 148, dots: 9, duration: 34 },
];

export function LoginShieldGraphic({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="loginShieldScan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--login-art-highlight)" stopOpacity="0" />
          <stop
            offset="50%"
            stopColor="var(--login-art-highlight)"
            stopOpacity="var(--login-art-scan-peak)"
          />
          <stop offset="100%" stopColor="var(--login-art-highlight)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="loginShieldClip">
          <path d="M200 168 L262 198 L262 276 C262 328 230 364 200 388 C170 364 138 328 138 276 L138 198 Z" />
        </clipPath>
      </defs>

      <g className={styles.ringSlow}>
        <circle
          cx="200"
          cy="255"
          r="78"
          stroke="var(--login-art-deep)"
          strokeWidth="0.75"
          opacity="var(--login-art-ring-a)"
        />
        <circle
          cx="200"
          cy="255"
          r="78"
          stroke="var(--login-art-brand)"
          strokeWidth="1.25"
          strokeDasharray="6 14"
          opacity="var(--login-art-ring-b)"
        />
      </g>
      <g className={styles.ringMid}>
        <circle
          cx="200"
          cy="255"
          r="112"
          stroke="var(--login-art-brand)"
          strokeWidth="0.95"
          strokeDasharray="2 10"
          opacity="var(--login-art-ring-c)"
        />
      </g>
      <g className={styles.ringFast}>
        <circle
          cx="200"
          cy="255"
          r="148"
          stroke="var(--login-art-accent)"
          strokeWidth="0.85"
          strokeDasharray="18 22"
          opacity="var(--login-art-ring-c)"
        />
      </g>

      {orbits.flatMap((orbit) =>
        Array.from({ length: orbit.dots }, (_, index) => (
          <g
            key={`${orbit.radius}-${index}`}
            className={styles.orbitDot}
            style={{
              animationDuration: `${orbit.duration}s`,
              animationDelay: `${(-index * orbit.duration) / orbit.dots}s`,
            }}
          >
            <circle
              cx={200 + orbit.radius}
              cy="255"
              r={index % 3 === 0 ? 2.4 : 1.5}
              fill="var(--login-art-dot)"
              opacity="0.92"
            />
          </g>
        )),
      )}

      <g className={styles.satellite}>
        <g transform="translate(68 92)">
          <circle
            r="16"
            stroke="var(--login-art-brand)"
            strokeWidth="1.1"
            opacity="var(--login-art-satellite)"
          />
          <circle r="7" stroke="var(--login-art-accent)" strokeWidth="1.2" />
          <circle r="2.2" fill="var(--login-art-accent)" />
        </g>
      </g>
      <g className={styles.satelliteRev}>
        <g transform="translate(332 118)">
          <circle
            r="14"
            stroke="var(--login-art-brand)"
            strokeWidth="1.1"
            opacity="var(--login-art-satellite)"
          />
          <circle r="6" stroke="var(--login-art-accent)" strokeWidth="1.2" />
          <circle r="2" fill="var(--login-art-accent)" />
        </g>
      </g>
      <g className={styles.satellite} style={{ animationDuration: "22s" }}>
        <g transform="translate(86 408)">
          <circle
            r="13"
            stroke="var(--login-art-brand)"
            strokeWidth="1.1"
            opacity="var(--login-art-satellite)"
          />
          <circle r="5.5" stroke="var(--login-art-accent)" strokeWidth="1.05" />
          <circle r="1.8" fill="var(--login-art-accent)" />
        </g>
      </g>

      <g className={styles.emblem}>
        <path
          className={styles.shieldStroke}
          d="M200 168 L262 198 L262 276 C262 328 230 364 200 388 C170 364 138 328 138 276 L138 198 Z"
          stroke="var(--login-art-accent)"
          strokeWidth="2.6"
          pathLength="1"
        />
        <path
          d="M200 182 L248 206 L248 272 C248 314 224 344 200 364 C176 344 152 314 152 272 L152 206 Z"
          stroke="var(--login-art-brand)"
          strokeWidth="0.95"
          opacity="var(--login-art-inner-shield)"
        />
        <g clipPath="url(#loginShieldClip)">
          <rect
            className={styles.scan}
            x="130"
            y="160"
            width="140"
            height="28"
            fill="url(#loginShieldScan)"
          />
        </g>
        <g className={styles.padlock}>
          <path
            d="M184 248 C184 232 216 232 216 248"
            stroke="var(--login-art-accent)"
            strokeWidth="4.4"
            strokeLinecap="round"
          />
          <rect
            x="176"
            y="246"
            width="48"
            height="38"
            rx="7"
            stroke="var(--login-art-accent)"
            strokeWidth="2.8"
          />
          <circle cx="200" cy="262" r="3.4" fill="var(--login-art-accent)" />
          <path
            d="M200 265.5 V276"
            stroke="var(--login-art-accent)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
