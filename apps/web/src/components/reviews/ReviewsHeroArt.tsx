export function ReviewsHeroArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={`contact-hero-art ${className}`.trim()}
      fill="none"
      aria-hidden
    >
      <rect
        className="contact-hero-art__letter"
        x="22"
        y="18"
        width="76"
        height="64"
        rx="8"
        fill="rgb(var(--bg-elevated))"
      />
      <path
        className="contact-hero-art__sparkle contact-hero-art__sparkle--1"
        d="M38 34l1.2 3.1 3.1 1.2-3.1 1.2L38 42.5l-1.2-3.1-3.1-1.2 3.1-1.2L38 34Z"
        fill="rgb(var(--brand))"
      />
      <path
        className="contact-hero-art__sparkle contact-hero-art__sparkle--2"
        d="M52 30l1 2.6 2.6 1-2.6 1L52 37.2l-1-2.6-2.6-1 2.6-1L52 30Z"
        fill="rgb(var(--brand))"
        opacity="0.85"
      />
      <path
        className="contact-hero-art__sparkle contact-hero-art__sparkle--1"
        d="M66 34l1.2 3.1 3.1 1.2-3.1 1.2L66 42.5l-1.2-3.1-3.1-1.2 3.1-1.2L66 34Z"
        fill="rgb(var(--brand))"
        opacity="0.75"
      />
      <path
        className="contact-hero-art__sparkle contact-hero-art__sparkle--2"
        d="M80 30l1 2.6 2.6 1-2.6 1L80 37.2l-1-2.6-2.6-1 2.6-1L80 30Z"
        fill="rgb(var(--brand))"
      />
      <circle
        className="contact-hero-art__sparkle contact-hero-art__sparkle--2"
        cx="94"
        cy="24"
        r="2.2"
        fill="rgb(var(--brand))"
        opacity="0.55"
      />
      <path
        className="contact-hero-art__letter-line contact-hero-art__letter-line--1"
        d="M34 54h52"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        className="contact-hero-art__letter-line contact-hero-art__letter-line--2"
        d="M34 64h52"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        className="contact-hero-art__letter-line contact-hero-art__letter-line--3"
        d="M34 74h34"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        className="contact-hero-art__envelope-front"
        d="M22 18h76v12H22V18Z"
        fill="rgb(var(--brand))"
        opacity="0.92"
      />
    </svg>
  );
}
