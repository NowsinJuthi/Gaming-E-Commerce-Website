"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefCallback } from "react";
import type { HomepageSlide } from "@/lib/api";
import { resolveMediaSrc } from "@/lib/site-appearance";
import {
  getHeroDesignLayers,
  isHero3dDesign,
  pickRandomHeroDesign,
  type HeroSliderDesign,
} from "@/components/home/home-hero-slider-designs";

type Props = {
  slides: HomepageSlide[];
};

const AUTOPLAY_MS = 6000;
const TRANSITION_MS = 950;

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeroSlideFrame({
  slide,
  design,
  active,
  exiting,
  priority,
}: {
  slide: HomepageSlide;
  design: HeroSliderDesign;
  active: boolean;
  exiting: boolean;
  priority: boolean;
}) {
  const [imgReady, setImgReady] = useState(false);

  useEffect(() => {
    setImgReady(false);
  }, [slide.imageUrl, active]);

  const imgRef: RefCallback<HTMLImageElement> = (node) => {
    if (node?.complete && node.naturalWidth > 0) {
      setImgReady(true);
    }
  };

  const visible = active || exiting;
  const showReveal = active && imgReady;
  const layers = getHeroDesignLayers(design);

  const slideClass = [
    "home-hero-slide",
    `home-hero-slide--${design}`,
    active ? "home-hero-slide--active" : "",
    exiting ? "home-hero-slide--exit" : "",
    showReveal ? "home-hero-slide--loaded" : "",
    isHero3dDesign(design) ? "home-hero-slide--is-3d" : "",
    layers.shine ? "home-hero-slide--has-shine" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <div className="home-hero-slide__scene">
        <div className="home-hero-slide__media">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded banner URLs vary by host */}
          <img
            ref={imgRef}
            src={resolveMediaSrc(slide.imageUrl)}
            alt={slide.alt.trim() || "Homepage banner"}
            width={1600}
            height={800}
            className={`home-hero-slide__img${imgReady ? " home-hero-slide__img--ready" : ""}`}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onLoad={() => setImgReady(true)}
          />
        </div>
      </div>
      <div className="home-hero-slide__reveal-mask" aria-hidden />
      <div className="home-hero-slide__reveal-bloom" aria-hidden />
      <div className="home-hero-slide__overlay" aria-hidden />
      <div className="home-hero-slide__fx" aria-hidden />
      {layers.shine ? <div className="home-hero-slide__shine" aria-hidden /> : null}
      {!imgReady && visible ? (
        <div className="home-hero-slide__loader" aria-hidden>
          <span className="home-hero-slide__loader-ring" />
        </div>
      ) : null}
    </>
  );

  if (!visible) return null;

  return (
    <div className={slideClass} aria-hidden={!active}>
      {slide.href.trim() ? (
        <a
          href={slide.href.trim()}
          tabIndex={active ? 0 : -1}
          className="home-hero-slide__link"
        >
          {body}
        </a>
      ) : (
        <div className="home-hero-slide__link">{body}</div>
      )}
    </div>
  );
}

export function HomeHeroSlider({ slides }: Props) {
  const activeSlides = useMemo(
    () =>
      slides
        .filter((slide) => slide.enabled && slide.imageUrl.trim())
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [slides],
  );

  const [index, setIndex] = useState(0);
  const [exitIndex, setExitIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [design, setDesign] = useState<HeroSliderDesign>("fade");
  const [ready, setReady] = useState(false);
  const indexRef = useRef(0);
  const skipCountResetRef = useRef(true);
  const count = activeSlides.length;

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
    setExitIndex(null);
    if (skipCountResetRef.current) {
      skipCountResetRef.current = false;
      return;
    }
    setDesign(pickRandomHeroDesign());
  }, [count]);

  const goTo = useCallback(
    (next: number) => {
      if (count <= 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  useEffect(() => {
    if (indexRef.current === index) return;
    const previous = indexRef.current;
    indexRef.current = index;
    setExitIndex(previous);
    setDesign((current) => pickRandomHeroDesign(current));
    const timer = window.setTimeout(() => setExitIndex(null), TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [index]);

  if (count === 0) return null;

  return (
    <section
      className={`home-hero-slider home-hero-slider--3d group relative mb-3 overflow-hidden rounded-2xl border border-white/10 bg-[#01131a] shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:mb-6${ready ? " home-hero-slider--ready" : ""}`}
      aria-label="Featured promotions"
      data-hero-design={design}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="home-hero-slider__stage relative aspect-[2/1] w-full sm:aspect-[21/9] lg:aspect-[4/1]">
        {activeSlides.map((slide, slideIndex) => (
          <HeroSlideFrame
            key={`${slide.imageUrl}-${slideIndex}`}
            slide={slide}
            design={slideIndex === index ? design : "fade"}
            active={slideIndex === index}
            exiting={exitIndex === slideIndex}
            priority={slideIndex === 0 || slideIndex === index}
          />
        ))}

        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => goTo(index - 1)}
              className="absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white opacity-0 backdrop-blur transition hover:bg-black/65 focus-visible:opacity-100 group-hover:opacity-100 sm:left-3 sm:h-10 sm:w-10"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => goTo(index + 1)}
              className="absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white opacity-0 backdrop-blur transition hover:bg-black/65 focus-visible:opacity-100 group-hover:opacity-100 sm:right-3 sm:h-10 sm:w-10"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 bg-gradient-to-t from-black/55 to-transparent px-4 pb-3 pt-8">
          {activeSlides.map((slide, dotIndex) => (
            <button
              key={`${slide.imageUrl}-${dotIndex}`}
              type="button"
              aria-label={`Go to slide ${dotIndex + 1}`}
              aria-current={dotIndex === index ? "true" : undefined}
              onClick={() => goTo(dotIndex)}
              className={`h-2 rounded-full transition-all ${
                dotIndex === index
                  ? "w-6 bg-brand"
                  : "w-2 bg-white/45 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
