import markStyles from "./media-poster-play-mark.module.css";

export function MediaPosterPlayMark({ size = "detail" }: { size?: "detail" | "card" }) {
  const rootClass =
    size === "card"
      ? `${markStyles.mark} ${markStyles.markCard}`
      : `${markStyles.mark} ${markStyles.markDetail}`;

  return (
    <span className={rootClass} aria-hidden>
      <span className={markStyles.glow} />
      <svg className={markStyles.rings} viewBox="0 0 80 80">
        <circle className={markStyles.track} cx="40" cy="40" r="34" />
        <circle className={markStyles.arc} cx="40" cy="40" r="34" />
        <circle className={markStyles.arcInner} cx="40" cy="40" r="26" />
      </svg>
      <span className={markStyles.core}>
        <svg viewBox="0 0 24 24" fill="#1a1000">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}
