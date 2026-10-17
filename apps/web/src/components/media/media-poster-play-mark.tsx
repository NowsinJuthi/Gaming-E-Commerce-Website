import markStyles from "./media-poster-play-mark.module.css";

export function MediaPosterPlayMark({ size = "detail" }: { size?: "detail" | "card" }) {
  const rootClass =
    size === "card"
      ? `${markStyles.root} ${markStyles.rootCard}`
      : `${markStyles.root} ${markStyles.rootDetail}`;

  return (
    <span className={rootClass} aria-hidden>
      <span className={markStyles.disc}>
        <svg className={markStyles.icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}
