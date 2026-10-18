import markStyles from "./media-poster-play-mark.module.css";

export function MediaPosterPlayMark({
  size = "detail",
  tone = "brand",
}: {
  size?: "detail" | "card";
  tone?: "brand" | "golden";
}) {
  const rootClass = [
    markStyles.root,
    size === "card" ? markStyles.rootCard : markStyles.rootDetail,
    tone === "golden" ? markStyles.rootGolden : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={rootClass} aria-hidden>
      <span className={markStyles.glow} />
      <svg className={markStyles.rings} viewBox="0 0 80 80">
        <circle className={markStyles.track} cx="40" cy="40" r="34" />
        <circle className={markStyles.arc} cx="40" cy="40" r="34" />
        <circle className={markStyles.arcInner} cx="40" cy="40" r="26" />
      </svg>
      <span className={markStyles.core}>
        <svg className={markStyles.icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}
