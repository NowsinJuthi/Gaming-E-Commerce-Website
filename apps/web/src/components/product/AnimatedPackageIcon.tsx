type Props = {
  className?: string;
};

export function AnimatedPackageIcon({ className = "h-5 w-5" }: Props) {
  return (
    <span className={`product-pdp-package-icon ${className}`} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="product-pdp-package-icon-svg"
      >
        <path
          className="product-pdp-package-icon-shell"
          d="M21 8 12 3 3 8v8l9 5 9-5V8Z"
        />
        <path className="product-pdp-package-icon-lid" d="m3 8 9 5 9-5" />
        <path className="product-pdp-package-icon-seam" d="M12 13v8" />
        <circle
          className="product-pdp-package-icon-spark"
          cx="18.5"
          cy="5.5"
          r="1"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    </span>
  );
}
