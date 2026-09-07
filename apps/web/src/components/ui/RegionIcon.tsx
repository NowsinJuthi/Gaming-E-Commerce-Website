import { getRegionFlagUrl, getRegionIcon } from "@/lib/region-icons";

type RegionIconProps = {
  region: string;
  className?: string;
  size?: 16 | 20 | 24;
};

const FLAG_HEIGHT_RATIO = 0.75;

export function RegionIcon({
  region,
  className = "",
  size = 16,
}: RegionIconProps) {
  const flagUrl = getRegionFlagUrl(region, size >= 20 ? 40 : 20);

  if (flagUrl) {
    const height = Math.max(12, Math.round(size * FLAG_HEIGHT_RATIO));
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={flagUrl}
        alt=""
        width={size}
        height={height}
        className={`region-icon region-icon--flag${className ? ` ${className}` : ""}`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      className={`region-icon region-icon--globe${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      {getRegionIcon(region)}
    </span>
  );
}
