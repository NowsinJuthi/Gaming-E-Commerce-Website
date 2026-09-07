type BubbleSpec = {
  id: number;
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  duration: number;
  delay: number;
  variant?: "soft" | "tiny" | "ring";
};

const BUBBLES: BubbleSpec[] = [
  { id: 1, size: 156, top: "-8%", right: "6%", duration: 26, delay: 0, variant: "soft" },
  { id: 2, size: 104, top: "16%", right: "26%", duration: 22, delay: -4 },
  { id: 3, size: 68, top: "60%", right: "10%", duration: 20, delay: -7 },
  { id: 4, size: 48, top: "6%", right: "46%", duration: 17, delay: -1 },
  { id: 5, size: 188, bottom: "-14%", right: "-6%", duration: 29, delay: -6, variant: "soft" },
  { id: 6, size: 118, bottom: "8%", right: "34%", duration: 24, delay: -9, variant: "soft" },
  { id: 7, size: 58, top: "40%", left: "56%", duration: 18, delay: -5 },
  { id: 8, size: 38, top: "22%", left: "70%", duration: 15, delay: -2 },
  { id: 9, size: 82, top: "68%", left: "62%", duration: 21, delay: -10 },
  { id: 10, size: 32, top: "12%", left: "42%", duration: 14, delay: -1 },
  { id: 11, size: 24, top: "50%", left: "76%", duration: 13, delay: -4, variant: "tiny" },
  { id: 12, size: 44, bottom: "16%", left: "50%", duration: 20, delay: -6 },
  { id: 13, size: 132, top: "28%", left: "-6%", duration: 28, delay: -8, variant: "soft" },
  { id: 14, size: 40, bottom: "6%", left: "36%", duration: 16, delay: -10 },
  { id: 15, size: 20, top: "34%", right: "16%", duration: 11, delay: -3, variant: "tiny" },
  { id: 16, size: 14, top: "76%", right: "50%", duration: 10, delay: -1, variant: "tiny" },
  { id: 17, size: 72, top: "48%", right: "20%", duration: 25, delay: -8, variant: "ring" },
  { id: 18, size: 52, bottom: "28%", left: "68%", duration: 21, delay: -5, variant: "ring" },
  { id: 19, size: 12, top: "20%", left: "58%", duration: 8, delay: -2, variant: "tiny" },
  { id: 20, size: 10, top: "58%", right: "40%", duration: 8, delay: -4, variant: "tiny" },
];

/** Full-box floating brand bubbles — light, dreamy soap-bubble ambient. */
export function MarketingHeroBubbles() {
  return (
    <div className="marketing-hero-bubbles" aria-hidden>
      <div className="marketing-hero-bubbles__wash" />
      <div className="marketing-hero-bubbles__sheen" />

      {BUBBLES.map((bubble) => (
        <span
          key={bubble.id}
          className={[
            "marketing-hero-bubble",
            bubble.variant === "soft" ? "marketing-hero-bubble--soft" : "",
            bubble.variant === "tiny" ? "marketing-hero-bubble--tiny" : "",
            bubble.variant === "ring" ? "marketing-hero-bubble--ring" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            width: bubble.size,
            height: bubble.size,
            top: bubble.top,
            left: bubble.left,
            right: bubble.right,
            bottom: bubble.bottom,
            animationDuration: `${bubble.duration}s`,
            animationDelay: `${bubble.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
