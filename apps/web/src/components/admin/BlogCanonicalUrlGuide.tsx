"use client";

import { GuideInfoIcon } from "@/components/admin/GuideInfoIcon";
import {
  GuideLanguageToggle,
  GuideList,
  GuideParagraph,
  GuideSectionHeading,
  GuideSummaryDot,
  GuideSummaryLabel,
  GuideSummaryLine,
  GuideSummaryValue,
  pickGuideText,
  useGuideLanguage,
  zipBilingualItems,
} from "@/components/admin/BlogGuideParts";
import {
  BLOG_CANONICAL_URL_DOCS,
  blogCanonicalDefaultPath,
  blogCanonicalDefaultUrl,
} from "@/lib/blog-canonical-url-spec";

type BlogCanonicalUrlGuideProps = {
  slug?: string;
};

export function BlogCanonicalUrlGuide({ slug = "" }: BlogCanonicalUrlGuideProps) {
  const doc = BLOG_CANONICAL_URL_DOCS;
  const defaultPath = blogCanonicalDefaultPath(slug);
  const defaultUrl = blogCanonicalDefaultUrl(slug);
  const { lang, setLang } = useGuideLanguage();

  return (
    <details className="blog-image-upload-guide group rounded-xl border border-border/55 bg-muted/15">
      <summary className="cursor-pointer list-none px-3.5 py-2.5 text-xs transition hover:bg-muted/25 [&::-webkit-details-marker]:hidden">
        <GuideSummaryLine>
          <GuideInfoIcon />
          <span className="font-medium text-foreground">
            {pickGuideText(doc.titleBn, doc.title, lang)}
          </span>
          <GuideSummaryDot />
          <GuideSummaryLabel bn="ঐচ্ছিক" en="Optional" lang={lang} />
          <GuideSummaryDot />
          <GuideSummaryLabel bn="ডিফল্ট" en="Default" lang={lang} />
          <GuideSummaryValue>{defaultPath}</GuideSummaryValue>
        </GuideSummaryLine>
      </summary>

      <div className="space-y-4 border-t border-border/40 px-3.5 py-3.5 text-xs leading-relaxed text-subtle">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
            {lang === "bn" ? "ভাষা নির্বাচন" : "Choose language"}
          </span>
          <GuideLanguageToggle lang={lang} onChange={setLang} />
        </div>

        <GuideParagraph bn={doc.summaryBn} en={doc.summary} lang={lang} />

        <section className="rounded-lg border border-border/50 bg-elevated/40 px-3 py-2.5">
          <GuideSectionHeading
            bn={doc.defaultHeadingBn}
            en={doc.defaultHeading}
            lang={lang}
          />
          <p className="mb-2 font-mono text-[11px] text-foreground">{defaultUrl}</p>
          <GuideList
            lang={lang}
            items={zipBilingualItems(doc.defaultPointsBn, doc.defaultPoints)}
          />
        </section>

        <section>
          <GuideSectionHeading
            bn={doc.whenHeadingBn}
            en={doc.whenHeading}
            lang={lang}
          />
          <GuideList
            lang={lang}
            items={zipBilingualItems(doc.whenPointsBn, doc.whenPoints)}
          />
        </section>

        <section>
          <GuideSectionHeading
            bn={doc.formatHeadingBn}
            en={doc.formatHeading}
            lang={lang}
          />
          <GuideList
            lang={lang}
            items={zipBilingualItems(doc.formatPointsBn, doc.formatPoints)}
          />
        </section>

        <section>
          <GuideSectionHeading
            bn={doc.avoidHeadingBn}
            en={doc.avoidHeading}
            lang={lang}
          />
          <GuideList
            lang={lang}
            items={zipBilingualItems(doc.avoidPointsBn, doc.avoidPoints)}
          />
        </section>
      </div>
    </details>
  );
}
