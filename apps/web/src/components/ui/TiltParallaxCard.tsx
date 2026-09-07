"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  maxTilt?: number;
  maxParallax?: number;
  enabled?: boolean;
  showGlare?: boolean;
};

export function TiltParallaxCard({
  children,
  className = "",
  innerClassName = "",
  maxTilt = 10,
  maxParallax = 14,
  enabled = true,
  showGlare = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, px: 0, py: 0 });
  const [active, setActive] = useState(false);

  const reset = useCallback(() => {
    setActive(false);
    setTilt({ rotateX: 0, rotateY: 0, px: 0, py: 0 });
  }, []);

  const onMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const node = wrapRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      setActive(true);
      setTilt({
        rotateY: x * maxTilt,
        rotateX: -y * maxTilt,
        px: x * maxParallax,
        py: y * maxParallax,
      });
    },
    [enabled, maxParallax, maxTilt],
  );

  const cardStyle: CSSProperties = {
    transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
  };

  const innerStyle: CSSProperties = {
    transform: `translate3d(${tilt.px}px, ${tilt.py}px, 0) scale(${active ? 1.02 : 1})`,
  };

  const glareStyle: CSSProperties = {
    opacity: active ? 1 : 0,
    background: `radial-gradient(circle at ${50 + tilt.px * 2}% ${50 + tilt.py * 2}%, rgb(255 255 255 / 0.22) 0%, transparent 58%)`,
  };

  return (
    <div
      ref={wrapRef}
      className={`tilt-parallax-card-wrap ${className}`.trim()}
      onMouseMove={onMove}
      onMouseLeave={reset}
    >
      <div
        className={`tilt-parallax-card ${active ? "tilt-parallax-card--active" : ""}`}
        style={cardStyle}
      >
        {showGlare ? (
          <span
            className="tilt-parallax-card-glare"
            style={glareStyle}
            aria-hidden
          />
        ) : null}
        <div
          className={`tilt-parallax-card-inner ${innerClassName}`.trim()}
          style={innerStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
