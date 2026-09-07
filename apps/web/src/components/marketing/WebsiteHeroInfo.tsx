import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import { WebsiteHeroArt } from "@/components/marketing/WebsiteHeroArt";

function WebsiteOfferIcon() {
  return (
    <span className="website-hero-info__offer-icon" aria-hidden>
      <span className="website-hero-info__offer-icon-ring" />
      <span className="website-hero-info__offer-icon-ring website-hero-info__offer-icon-ring--2" />
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="website-hero-info__offer-icon-svg"
      >
        <path
          className="website-hero-info__offer-icon-tag"
          d="M10 24 24 10l14 14-14 14L10 24Z"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinejoin="round"
        />
        <circle
          className="website-hero-info__offer-icon-hole"
          cx="24"
          cy="16"
          r="3.25"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          className="website-hero-info__offer-icon-percent"
          d="M30.5 28.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Zm-5.5 5.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM33 25 25 33"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <circle
          className="website-hero-info__offer-icon-spark website-hero-info__offer-icon-spark--1"
          cx="38"
          cy="12"
          r="2"
          fill="currentColor"
        />
        <circle
          className="website-hero-info__offer-icon-spark website-hero-info__offer-icon-spark--2"
          cx="8"
          cy="34"
          r="1.5"
          fill="currentColor"
        />
        <path
          className="website-hero-info__offer-icon-spark website-hero-info__offer-icon-spark--3"
          d="M42 30l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function WebsiteNoteIcon() {
  return (
    <span className="website-hero-info__note-icon" aria-hidden>
      <span className="website-hero-info__note-icon-ring" />
      <span className="website-hero-info__note-icon-ring website-hero-info__note-icon-ring--2" />
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="website-hero-info__note-icon-svg"
      >
        <rect
          className="website-hero-info__note-icon-browser"
          x="8"
          y="12"
          width="28"
          height="22"
          rx="3.5"
          stroke="currentColor"
          strokeWidth="2.25"
        />
        <path
          className="website-hero-info__note-icon-bar"
          d="M8 18h28"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <circle
          className="website-hero-info__note-icon-dot website-hero-info__note-icon-dot--1"
          cx="13"
          cy="15"
          r="1.4"
          fill="currentColor"
        />
        <circle
          className="website-hero-info__note-icon-dot website-hero-info__note-icon-dot--2"
          cx="17.5"
          cy="15"
          r="1.4"
          fill="currentColor"
        />
        <rect
          className="website-hero-info__note-icon-block website-hero-info__note-icon-block--1"
          x="12"
          y="22"
          width="10"
          height="8"
          rx="1.5"
          fill="currentColor"
        />
        <rect
          className="website-hero-info__note-icon-block website-hero-info__note-icon-block--2"
          x="24"
          y="22"
          width="8"
          height="3.5"
          rx="1"
          fill="currentColor"
        />
        <rect
          className="website-hero-info__note-icon-block website-hero-info__note-icon-block--3"
          x="24"
          y="27"
          width="8"
          height="3"
          rx="1"
          fill="currentColor"
        />
        <path
          className="website-hero-info__note-icon-pencil"
          d="M30 8.5 39.5 18 35 22.5 25.5 13 30 8.5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          className="website-hero-info__note-icon-pencil-tip"
          d="M25.5 13 22 16.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          className="website-hero-info__note-icon-spark website-hero-info__note-icon-spark--1"
          cx="40"
          cy="10"
          r="1.6"
          fill="currentColor"
        />
        <path
          className="website-hero-info__note-icon-spark website-hero-info__note-icon-spark--2"
          d="M6 28l1.2 2.4 2.4 1.2-2.4 1.2L6 34.8 4.8 32.4 2.4 31.2l2.4-1.2L6 28Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function splitHeroHeading(raw: string): { head: string; tail: string } {
  const text = raw.trim();
  const packageIdx = text.indexOf("Package");
  if (packageIdx > 0) {
    return {
      head: text.slice(0, packageIdx).trim(),
      tail: text.slice(packageIdx).trim(),
    };
  }
  const words = text.split(/\s+/);
  if (words.length < 2) return { head: text, tail: "" };
  return {
    head: words.slice(0, -2).join(" "),
    tail: words.slice(-2).join(" "),
  };
}

type WebsiteHeroInfoProps = {
  eyebrow: string;
  heading: string;
  subheading: string;
  offerTitle: string;
  offerText: string;
  heroNoteTitle: string;
  heroNoteText: string;
  heroNoteSubtext: string;
};

export function WebsiteHeroInfo({
  eyebrow,
  heading,
  subheading,
  offerTitle,
  offerText,
  heroNoteTitle,
  heroNoteText,
  heroNoteSubtext,
}: WebsiteHeroInfoProps) {
  const title = splitHeroHeading(heading);

  return (
    <section className="website-hero-info" aria-label="Website development packages">
      <MarketingHeroBubbles />
      <span className="website-hero-info__glow website-hero-info__glow--1" aria-hidden />
      <span className="website-hero-info__glow website-hero-info__glow--2" aria-hidden />
      <span className="website-hero-info__glow website-hero-info__glow--3" aria-hidden />
      <span className="website-hero-info__aurora" aria-hidden />
      <span className="website-hero-info__grid" aria-hidden />
      <span className="website-hero-info__ring" aria-hidden />
      <span className="website-hero-info__ring website-hero-info__ring--2" aria-hidden />

      <div className="website-hero-info__shell">
        <div className="website-hero-info__layout">
          <div className="website-hero-info__main">
            {eyebrow ? (
              <span className="website-hero-info__eyebrow">{eyebrow}</span>
            ) : null}
            <h1 className="website-hero-info__title">
              {title.head}
              {title.tail ? (
                <>
                  {" "}
                  <span className="website-hero-info__title-accent">{title.tail}</span>
                </>
              ) : null}
            </h1>
            {subheading ? (
              <p className="website-hero-info__subtitle">{subheading}</p>
            ) : null}
          </div>

          <div className="website-hero-info__art-wrap">
            <WebsiteHeroArt />
          </div>
        </div>

        <div className="website-hero-info__content">
          {offerText ? (
            <div className="website-hero-info__offer">
              <WebsiteOfferIcon />
              <div className="website-hero-info__offer-body">
                {offerTitle ? (
                  <p className="website-hero-info__offer-title">{offerTitle}</p>
                ) : null}
                <p className="website-hero-info__offer-text">{offerText}</p>
              </div>
            </div>
          ) : null}

          {heroNoteText || heroNoteSubtext ? (
            <div className="website-hero-info__note">
              <WebsiteNoteIcon />
              <div className="website-hero-info__note-body">
                {heroNoteTitle ? (
                  <p className="website-hero-info__note-title">{heroNoteTitle}</p>
                ) : null}
                {heroNoteText ? (
                  <p className="website-hero-info__note-lead">{heroNoteText}</p>
                ) : null}
                {heroNoteSubtext ? (
                  <p className="website-hero-info__note-subtext">{heroNoteSubtext}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
