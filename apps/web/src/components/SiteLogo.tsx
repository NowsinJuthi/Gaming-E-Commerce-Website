"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useInitialSiteBrand } from "@/components/site-brand-initial-context";
import { resolveLogoSrc } from "@/lib/site-appearance";
import { useSiteBrandStore } from "@/stores/site-brand-store";

export type SiteLogoOverride = {
  logoUrlLight?: string;
  logoUrlDark?: string;
  logoUrlFooterLight?: string;
  logoUrlFooterDark?: string;
  logoAlt?: string;
  siteName?: string;
  /** Admin preview — force light or dark logo */
  previewTheme?: "light" | "dark";
};

type LogoSize = "default" | "compact" | "admin" | "footer";

type SiteLogoProps = {
  href?: string | null;
  className?: string;
  size?: LogoSize;
  showWave?: boolean;
  title?: string;
  onLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Admin preview — bypasses global store */
  override?: SiteLogoOverride;
};

function LogoWave({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 80 8" className={className} aria-hidden>
      <path
        d="M0 6 Q20 0 40 5 T80 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TextLogo({
  siteName,
  size,
  showWave,
}: {
  siteName: string;
  size: LogoSize;
  showWave: boolean;
}) {
  const first = siteName.charAt(0) || "A";
  const rest = siteName.slice(1) || "marpin";

  const textSize =
    size === "compact"
      ? "text-lg"
      : size === "footer"
        ? "text-2xl md:text-3xl"
        : size === "admin"
          ? "text-xl md:text-2xl"
          : "text-xl md:text-2xl";
  const firstSize =
    size === "compact"
      ? "text-2xl"
      : size === "footer"
        ? "text-4xl md:text-5xl"
        : size === "admin"
          ? "text-3xl md:text-4xl"
          : "text-3xl md:text-4xl";
  const waveSize =
    size === "compact"
      ? "h-1.5 w-12"
      : size === "footer"
        ? "h-2 w-16 md:w-20"
        : size === "admin"
          ? "h-2 w-16 md:w-[4.5rem]"
          : "h-2 w-14 md:w-16";

  return (
    <>
      <span
        className={`flex items-baseline font-extrabold leading-none tracking-tight ${textSize}`}
      >
        <span className={`text-foreground ${firstSize}`}>{first}</span>
        <span className="text-brand">{rest}</span>
      </span>
      {showWave && (
        <LogoWave className={`mt-0.5 text-brand ${waveSize}`} />
      )}
    </>
  );
}

export function SiteLogo({
  href = "/",
  className = "",
  size = "default",
  showWave = true,
  title,
  onLinkClick,
  override,
}: SiteLogoProps) {
  const storeLogoUrlLight = useSiteBrandStore((s) => s.logoUrlLight);
  const storeLogoUrlDark = useSiteBrandStore((s) => s.logoUrlDark);
  const storeLogoAlt = useSiteBrandStore((s) => s.logoAlt);
  const storeSiteName = useSiteBrandStore((s) => s.siteName);
  const initialBrand = useInitialSiteBrand();

  const rawLight = (
    override?.logoUrlLight ??
    initialBrand?.logoUrlLight ??
    storeLogoUrlLight ??
    ""
  ).trim();
  const rawDark = (
    override?.logoUrlDark ??
    initialBrand?.logoUrlDark ??
    storeLogoUrlDark ??
    ""
  ).trim();
  const logoAlt =
    override?.logoAlt ?? initialBrand?.logoAlt ?? storeLogoAlt;
  const siteName =
    override?.siteName ?? initialBrand?.siteName ?? storeSiteName;

  const lightUrl = resolveLogoSrc(rawLight);
  const darkUrl = resolveLogoSrc(rawDark);

  const imageSize =
    size === "compact"
      ? "h-10 max-w-[180px]"
      : size === "footer"
        ? "h-14 max-w-[280px] md:h-16 md:max-w-[320px]"
        : size === "admin"
          ? "h-10 max-w-[130px] sm:h-11 sm:max-w-[180px] lg:h-12 lg:max-w-[260px]"
          : "h-11 max-w-[210px] md:h-12 md:max-w-[250px]";

  const wrapperClass = `flex flex-col items-start transition hover:opacity-90 ${className}`;
  const altText = logoAlt || siteName;

  // ── Admin preview: force one specific logo ──────────────────────────────────
  if (override?.previewTheme) {
    const forcedUrl = override.previewTheme === "light" ? lightUrl : darkUrl;
    const content = forcedUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={forcedUrl}
        alt={altText}
        className={`site-logo-img w-auto object-contain ${imageSize}`}
      />
    ) : (
      <TextLogo siteName={siteName} size={size} showWave={showWave} />
    );
    if (href) {
      return (
        <Link
          href={href as "/"}
          className={wrapperClass}
          title={title}
          onClick={onLinkClick}
        >
          {content}
        </Link>
      );
    }
    return <div className={wrapperClass}>{content}</div>;
  }

  // ── Both light + dark logos available ───────────────────────────────────────
  // Render BOTH images; CSS dark:hidden / hidden dark:block toggles them based
  // on the `.dark` class that ThemeScript sets synchronously on <html>.
  // This means zero React-state involvement → no hydration mismatch, no flash.
  let content: React.ReactNode;
  if (lightUrl && darkUrl) {
    content = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lightUrl}
          alt={altText}
          className={`site-logo-img site-logo-img--light w-auto object-contain ${imageSize}`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={darkUrl}
          alt={altText}
          className={`site-logo-img site-logo-img--dark w-auto object-contain ${imageSize}`}
        />
      </>
    );
  } else {
    // Only one logo configured, or none — single img or text fallback
    const singleUrl = lightUrl || darkUrl;
    content = singleUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={singleUrl}
        alt={altText}
        className={`site-logo-img w-auto object-contain ${imageSize}`}
      />
    ) : (
      <TextLogo siteName={siteName} size={size} showWave={showWave} />
    );
  }

  if (href) {
    return (
      <Link
        href={href as "/"}
        className={wrapperClass}
        title={title}
        onClick={onLinkClick}
      >
        {content}
      </Link>
    );
  }
  return <div className={wrapperClass}>{content}</div>;
}
