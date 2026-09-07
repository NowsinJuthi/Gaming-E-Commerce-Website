export function ContactHeroArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={`contact-hero-art ${className}`.trim()}
      fill="none"
      aria-hidden
    >
      <path
        className="contact-hero-art__envelope-back"
        d="M18 42 60 18l42 24v36a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V42Z"
        fill="rgb(var(--brand))"
        opacity="0.9"
      />
      <rect
        className="contact-hero-art__letter"
        x="30"
        y="26"
        width="60"
        height="44"
        rx="5"
        fill="rgb(var(--bg-elevated))"
      />
      <path
        className="contact-hero-art__letter-line contact-hero-art__letter-line--1"
        d="M40 40h40"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        className="contact-hero-art__letter-line contact-hero-art__letter-line--2"
        d="M40 48h40"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        className="contact-hero-art__letter-line contact-hero-art__letter-line--3"
        d="M40 56h26"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        className="contact-hero-art__envelope-front"
        d="M18 42v36a8 8 0 0 0 8 8h68a8 8 0 0 0 8-8V42L60 68 18 42Z"
        fill="rgb(var(--brand))"
      />
      <path
        className="contact-hero-art__envelope-fold"
        d="M18 42 60 68l42-26"
        stroke="rgb(var(--bg-elevated))"
        strokeWidth="2"
        opacity="0.35"
      />
      <path
        className="contact-hero-art__sparkle contact-hero-art__sparkle--1"
        d="M97 12l1.7 4.3 4.3 1.7-4.3 1.7L97 24l-1.7-4.3L91 18l4.3-1.7L97 12Z"
        fill="rgb(var(--brand))"
        opacity="0.9"
      />
      <circle
        className="contact-hero-art__sparkle contact-hero-art__sparkle--2"
        cx="108"
        cy="30"
        r="2.4"
        fill="rgb(var(--brand))"
        opacity="0.6"
      />
    </svg>
  );
}
