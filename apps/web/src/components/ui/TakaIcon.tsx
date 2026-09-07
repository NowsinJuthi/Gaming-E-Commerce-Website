type TakaIconProps = {
  className?: string;
};

/** Bold Unicode ৳ — inherits parent font and color. */
export function TakaIcon({ className = "" }: TakaIconProps) {
  return (
    <span className={className} aria-hidden>
      ৳
    </span>
  );
}
