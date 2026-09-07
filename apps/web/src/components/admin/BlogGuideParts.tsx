"use client";

import { useEffect, useState, type ReactNode } from "react";

export type GuideLanguage = "bn" | "en";

const STORAGE_KEY = "blog-guide-language";

type BilingualItem = {
  bn: string;
  en: string;
};

export function zipBilingualItems(
  bn: readonly string[],
  en: readonly string[],
): BilingualItem[] {
  return bn.map((bnText, index) => ({
    bn: bnText,
    en: en[index] ?? "",
  }));
}

export function useGuideLanguage(): {
  lang: GuideLanguage;
  setLang: (lang: GuideLanguage) => void;
} {
  const [lang, setLangState] = useState<GuideLanguage>("bn");

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === "bn" || saved === "en") {
      setLangState(saved);
    }
  }, []);

  function setLang(next: GuideLanguage) {
    setLangState(next);
    sessionStorage.setItem(STORAGE_KEY, next);
  }

  return { lang, setLang };
}

export function pickGuideText(
  bn: string,
  en: string,
  lang: GuideLanguage,
): string {
  return lang === "bn" ? bn : en;
}

export function GuideLanguageToggle({
  lang,
  onChange,
}: {
  lang: GuideLanguage;
  onChange: (lang: GuideLanguage) => void;
}) {
  return (
    <div
      className="guide-language-toggle inline-flex rounded-lg border border-border/55 bg-muted/25 p-0.5"
      role="group"
      aria-label="Guide language"
    >
      <button
        type="button"
        className={`guide-language-toggle__btn rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
          lang === "bn"
            ? "guide-language-toggle__btn--active"
            : "text-subtle hover:text-foreground"
        }`}
        aria-pressed={lang === "bn"}
        onClick={(e) => {
          e.preventDefault();
          onChange("bn");
        }}
      >
        বাংলা
      </button>
      <button
        type="button"
        className={`guide-language-toggle__btn rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
          lang === "en"
            ? "guide-language-toggle__btn--active"
            : "text-subtle hover:text-foreground"
        }`}
        aria-pressed={lang === "en"}
        onClick={(e) => {
          e.preventDefault();
          onChange("en");
        }}
      >
        English
      </button>
    </div>
  );
}

export function GuideSectionHeading({
  bn,
  en,
  lang,
}: {
  bn: string;
  en: string;
  lang: GuideLanguage;
}) {
  return (
    <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
      {pickGuideText(bn, en, lang)}
    </h4>
  );
}

export function GuideParagraph({
  bn,
  en,
  lang,
}: {
  bn: string;
  en: string;
  lang: GuideLanguage;
}) {
  return (
    <p className="text-foreground-muted">{pickGuideText(bn, en, lang)}</p>
  );
}

export function GuideList({
  items,
  lang,
  ordered = false,
}: {
  items: BilingualItem[];
  lang: GuideLanguage;
  ordered?: boolean;
}) {
  const Tag = ordered ? "ol" : "ul";
  const listClass = ordered
    ? "list-decimal space-y-1.5 pl-4"
    : "list-disc space-y-1.5 pl-4";

  return (
    <Tag className={listClass}>
      {items.map((item) => (
        <li key={`${item.bn}-${item.en}`}>
          {pickGuideText(item.bn, item.en, lang)}
        </li>
      ))}
    </Tag>
  );
}

export function GuideSummaryLine({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {children}
    </span>
  );
}

export function GuideSummaryDot() {
  return (
    <span className="text-border" aria-hidden>
      ·
    </span>
  );
}

export function GuideSummaryLabel({
  bn,
  en,
  lang,
}: {
  bn: string;
  en: string;
  lang: GuideLanguage;
}) {
  return (
    <span className="text-subtle">{pickGuideText(bn, en, lang)}</span>
  );
}

export function GuideSummaryValue({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>;
}
