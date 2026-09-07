export function BlogHeroArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={`blog-hero-art ${className}`.trim()}
      fill="none"
      aria-hidden
    >
      <path
        className="blog-hero-art__page blog-hero-art__page--back"
        d="M24 18h34a6 6 0 0 1 6 6v58a6 6 0 0 1-6 6H24V18Z"
        fill="rgb(var(--brand))"
        opacity="0.22"
      />
      <path
        className="blog-hero-art__page blog-hero-art__page--front"
        d="M38 14h48a8 8 0 0 1 8 8v60a8 8 0 0 1-8 8H38V14Z"
        fill="rgb(var(--bg-elevated))"
      />
      <path
        className="blog-hero-art__cover"
        d="M38 14v76a8 8 0 0 0 8 8h40a8 8 0 0 0 8-8V22a8 8 0 0 0-8-8H46a8 8 0 0 0-8 8Z"
        stroke="rgb(var(--brand))"
        strokeWidth="2.5"
        opacity="0.9"
      />
      <path
        className="blog-hero-art__spine"
        d="M38 14v76"
        stroke="rgb(var(--brand))"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="blog-hero-art__line blog-hero-art__line--1"
        d="M52 34h44"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        className="blog-hero-art__line blog-hero-art__line--2"
        d="M52 44h44"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        className="blog-hero-art__line blog-hero-art__line--3"
        d="M52 54h30"
        stroke="rgb(var(--brand))"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle
        className="blog-hero-art__badge"
        cx="78"
        cy="68"
        r="11"
        fill="rgb(var(--brand))"
        opacity="0.92"
      />
      <path
        className="blog-hero-art__badge-icon"
        d="M74 68l3 3 6-6"
        stroke="rgb(var(--bg-elevated))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="blog-hero-art__sparkle blog-hero-art__sparkle--1"
        d="M16 24l1.4 3.6 3.6 1.4-3.6 1.4L16 34l-1.4-3.6L11 29l4.6-1.8L16 24Z"
        fill="rgb(var(--brand))"
        opacity="0.9"
      />
      <circle
        className="blog-hero-art__sparkle blog-hero-art__sparkle--2"
        cx="10"
        cy="42"
        r="2.2"
        fill="rgb(var(--brand))"
        opacity="0.55"
      />
    </svg>
  );
}
