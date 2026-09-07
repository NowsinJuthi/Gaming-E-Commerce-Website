"use client";

import {
  BLOG_IMAGE_ACCEPTED_FORMATS,
  BLOG_IMAGE_OUTPUT_FORMAT,
  BLOG_IMAGE_TARGET_SIZE_LABEL,
  BLOG_IMAGE_UPLOAD_DOCS,
} from "@/lib/blog-image-spec";
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

export function BlogImageUploadGuide() {
  const doc = BLOG_IMAGE_UPLOAD_DOCS;
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
          <GuideSummaryLabel
            bn="আউটপুট সাইজ"
            en="Output size"
            lang={lang}
          />
          <GuideSummaryValue>{BLOG_IMAGE_TARGET_SIZE_LABEL} px</GuideSummaryValue>
          <GuideSummaryDot />
          <GuideSummaryValue>{BLOG_IMAGE_OUTPUT_FORMAT}</GuideSummaryValue>
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

        <section>
          <GuideSectionHeading
            bn={doc.acceptedHeadingBn}
            en={doc.acceptedHeading}
            lang={lang}
          />
          <ul className="flex flex-wrap gap-1.5">
            {BLOG_IMAGE_ACCEPTED_FORMATS.map((format) => (
              <li
                key={format}
                className="rounded-full border border-border/60 bg-elevated/60 px-2 py-0.5 text-[11px] text-foreground"
              >
                {format}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <GuideSectionHeading
            bn={doc.conversionHeadingBn}
            en={doc.conversionHeading}
            lang={lang}
          />
          <GuideList
            ordered
            lang={lang}
            items={zipBilingualItems(doc.conversionStepsBn, doc.conversionSteps)}
          />
        </section>

        <section className="rounded-lg border border-brand/25 bg-brand/5 px-3 py-2.5">
          <GuideSectionHeading
            bn={doc.outputHeadingBn}
            en={doc.outputHeading}
            lang={lang}
          />
          <GuideList
            lang={lang}
            items={zipBilingualItems(doc.outputDetailsBn, doc.outputDetails)}
          />
        </section>

        <section>
          <GuideSectionHeading
            bn={doc.tipsHeadingBn}
            en={doc.tipsHeading}
            lang={lang}
          />
          <GuideList
            lang={lang}
            items={zipBilingualItems(doc.tipsBn, doc.tips)}
          />
        </section>
      </div>
    </details>
  );
}
