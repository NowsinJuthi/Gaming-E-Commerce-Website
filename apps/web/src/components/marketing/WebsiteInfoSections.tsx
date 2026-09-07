import type {

  WebsiteGuideSection,

  WebsiteIntroSection,

} from "@/lib/website-page-settings";



function WebsiteInfoArtStage({ variant }: { variant: "intro" | "guide" }) {

  return (

    <>

      <span

        className={`website-info-section__art-glow website-info-section__art-glow--${variant}`}

        aria-hidden

      />

      <span className="website-info-section__art-grid" aria-hidden />

      <span className="website-info-section__art-ring" aria-hidden />

      <span

        className="website-info-section__art-ring website-info-section__art-ring--2"

        aria-hidden

      />

      {variant === "guide" ? (

        <>

          <span className="website-info-section__art-orbit" aria-hidden />

          <span

            className="website-info-section__art-orbit website-info-section__art-orbit--2"

            aria-hidden

          />

        </>

      ) : null}

    </>

  );

}



function IntroParagraphIcon({ paragraphIndex }: { paragraphIndex: number }) {
  const variant = paragraphIndex % 3;

  return (
    <span
      className={`website-info-section__step-icon website-info-section__step-icon--${variant}`}
      aria-hidden
    >
      <span className="website-info-section__step-icon-ring" />
      <span className="website-info-section__step-icon-ring website-info-section__step-icon-ring--2" />

      {variant === 0 ? (
        <svg viewBox="0 0 48 48" fill="none" className="website-info-section__step-icon-svg">
          <path
            className="website-info-intro__shield"
            d="M24 8 12 14v10c0 9 5.5 14.5 12 16 6.5-1.5 12-7 12-16V14L24 8Z"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinejoin="round"
          />
          <path
            className="website-info-intro__shield-bolt"
            d="M26 18 22 26h6l-2 8 8-12h-6l2-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle
            className="website-info-intro__shield-spark"
            cx="36"
            cy="12"
            r="2"
            fill="currentColor"
          />
        </svg>
      ) : null}

      {variant === 1 ? (
        <svg viewBox="0 0 48 48" fill="none" className="website-info-section__step-icon-svg">
          <rect
            className="website-info-intro__phone"
            x="16"
            y="8"
            width="16"
            height="32"
            rx="3.5"
            stroke="currentColor"
            strokeWidth="2.25"
          />
          <path
            className="website-info-intro__phone-bar"
            d="M16 14h16"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <rect
            className="website-info-intro__phone-block website-info-intro__phone-block--1"
            x="20"
            y="18"
            width="8"
            height="8"
            rx="1.5"
            fill="currentColor"
          />
          <rect
            className="website-info-intro__phone-block website-info-intro__phone-block--2"
            x="20"
            y="28"
            width="8"
            height="3"
            rx="1"
            fill="currentColor"
          />
          <rect
            className="website-info-intro__phone-block website-info-intro__phone-block--3"
            x="20"
            y="33"
            width="8"
            height="3"
            rx="1"
            fill="currentColor"
          />
          <path
            className="website-info-intro__phone-signal"
            d="M34 20v8M38 16v16M42 12v24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : null}

      {variant === 2 ? (
        <svg viewBox="0 0 48 48" fill="none" className="website-info-section__step-icon-svg">
          <path
            className="website-info-intro__growth-chart"
            d="M10 34h28"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <path
            className="website-info-intro__growth-line"
            d="M14 30 22 22l6 6 12-14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="website-info-intro__growth-arrow"
            d="M34 14h8v8"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            className="website-info-intro__growth-bar website-info-intro__growth-bar--1"
            x="12"
            y="26"
            width="5"
            height="8"
            rx="1"
            fill="currentColor"
          />
          <rect
            className="website-info-intro__growth-bar website-info-intro__growth-bar--2"
            x="20"
            y="20"
            width="5"
            height="14"
            rx="1"
            fill="currentColor"
          />
          <circle
            className="website-info-intro__growth-spark"
            cx="38"
            cy="10"
            r="2"
            fill="currentColor"
          />
        </svg>
      ) : null}
    </span>
  );
}

function GuideStepIcon({ stepIndex }: { stepIndex: number }) {

  const variant = stepIndex % 3;



  return (

    <span

      className={`website-info-section__step-icon website-info-section__step-icon--${variant}`}

      aria-hidden

    >

      <span className="website-info-section__step-icon-ring" />

      <span className="website-info-section__step-icon-ring website-info-section__step-icon-ring--2" />



      {variant === 0 ? (

        <svg viewBox="0 0 48 48" fill="none" className="website-info-section__step-icon-svg">

          <rect

            className="website-info-step__package-box"

            x="10"

            y="14"

            width="28"

            height="22"

            rx="4"

            stroke="currentColor"

            strokeWidth="2.25"

          />

          <path

            className="website-info-step__package-lid"

            d="M10 18h28"

            stroke="currentColor"

            strokeWidth="2.25"

            strokeLinecap="round"

          />

          <path

            className="website-info-step__package-ribbon"

            d="M24 14v8M20 18h8"

            stroke="currentColor"

            strokeWidth="2"

            strokeLinecap="round"

          />

          <circle

            className="website-info-step__package-spark"

            cx="36"

            cy="12"

            r="2"

            fill="currentColor"

          />

        </svg>

      ) : null}



      {variant === 1 ? (

        <svg viewBox="0 0 48 48" fill="none" className="website-info-section__step-icon-svg">

          <rect

            className="website-info-step__content-doc"

            x="12"

            y="10"

            width="22"

            height="28"

            rx="3"

            stroke="currentColor"

            strokeWidth="2.25"

          />

          <path

            className="website-info-step__content-line website-info-step__content-line--1"

            d="M17 18h12"

            stroke="currentColor"

            strokeWidth="2"

            strokeLinecap="round"

          />

          <path

            className="website-info-step__content-line website-info-step__content-line--2"

            d="M17 24h9"

            stroke="currentColor"

            strokeWidth="2"

            strokeLinecap="round"

          />

          <path

            className="website-info-step__content-upload"

            d="M30 30l6-6 6 6M36 24v12"

            stroke="currentColor"

            strokeWidth="2.25"

            strokeLinecap="round"

            strokeLinejoin="round"

          />

        </svg>

      ) : null}



      {variant === 2 ? (

        <svg viewBox="0 0 48 48" fill="none" className="website-info-section__step-icon-svg">

          <path

            className="website-info-step__launch-rocket"

            d="M24 8l6 14H18L24 8Z"

            stroke="currentColor"

            strokeWidth="2.25"

            strokeLinejoin="round"

          />

          <path

            className="website-info-step__launch-body"

            d="M18 22h12v10c0 2-2 4-6 4s-6-2-6-4V22Z"

            stroke="currentColor"

            strokeWidth="2.25"

            strokeLinejoin="round"

          />

          <path

            className="website-info-step__launch-flame"

            d="M24 36v6M20 40h8"

            stroke="currentColor"

            strokeWidth="2.25"

            strokeLinecap="round"

          />

          <circle

            className="website-info-step__launch-spark"

            cx="34"

            cy="14"

            r="2"

            fill="currentColor"

          />

          <path

            className="website-info-step__launch-star"

            d="M10 20l1.2 2.4 2.4 1.2-2.4 1.2L10 27.2 8.8 24.8 6.4 23.6l2.4-1.2L10 20Z"

            fill="currentColor"

          />

        </svg>

      ) : null}

    </span>

  );

}



function WebsiteDevIllustration() {

  return (

    <svg

      viewBox="0 0 420 320"

      className="website-info-section__art-svg website-info-section__art-svg--intro"

      fill="none"

      aria-hidden

    >

      <ellipse className="website-info-art__intro-shadow" cx="210" cy="252" rx="118" ry="10" fill="rgb(var(--brand) / 0.14)" />

      <rect className="website-info-art__intro-desk" x="48" y="210" width="120" height="10" rx="5" fill="rgb(var(--brand) / 0.18)" />

      <rect className="website-info-art__intro-body" x="92" y="168" width="36" height="52" rx="8" fill="rgb(var(--brand) / 0.22)" />

      <circle className="website-info-art__intro-head" cx="110" cy="156" r="16" fill="rgb(var(--brand) / 0.35)" />

      <rect className="website-info-art__intro-monitor" x="150" y="132" width="150" height="96" rx="12" fill="rgb(var(--bg-elevated))" stroke="rgb(var(--brand) / 0.35)" strokeWidth="3" />

      <rect className="website-info-art__intro-screen-bar" x="166" y="148" width="118" height="12" rx="4" fill="rgb(var(--brand) / 0.25)" />

      <rect className="website-info-art__intro-line website-info-art__intro-line--1" x="166" y="170" width="88" height="8" rx="3" fill="rgb(var(--foreground-muted) / 0.25)" />

      <rect className="website-info-art__intro-line website-info-art__intro-line--2" x="166" y="186" width="72" height="8" rx="3" fill="rgb(var(--foreground-muted) / 0.18)" />

      <rect className="website-info-art__intro-line website-info-art__intro-line--3" x="166" y="202" width="96" height="8" rx="3" fill="rgb(var(--foreground-muted) / 0.14)" />

      <path className="website-info-art__intro-cursor" d="M286 198h28" stroke="rgb(var(--brand))" strokeWidth="4" strokeLinecap="round" />

      <circle className="website-info-art__intro-badge" cx="318" cy="88" r="28" fill="rgb(var(--brand) / 0.12)" stroke="rgb(var(--brand) / 0.4)" strokeWidth="2" />

      <path className="website-info-art__intro-plus" d="M306 88h24M318 76v24" stroke="rgb(var(--brand))" strokeWidth="3" strokeLinecap="round" />

      <rect className="website-info-art__intro-card" x="58" y="78" width="54" height="40" rx="8" fill="rgb(var(--brand) / 0.14)" stroke="rgb(var(--brand) / 0.3)" strokeWidth="2" />

      <path className="website-info-art__intro-card-line website-info-art__intro-card-line--1" d="M72 98h24" stroke="rgb(var(--brand))" strokeWidth="3" strokeLinecap="round" />

      <path className="website-info-art__intro-card-line website-info-art__intro-card-line--2" d="M72 106h16" stroke="rgb(var(--brand))" strokeWidth="3" strokeLinecap="round" />

      <circle className="website-info-art__intro-orbit" cx="332" cy="206" r="18" fill="rgb(var(--brand) / 0.16)" />

      <path className="website-info-art__intro-orbit-plus" d="M324 206h16M332 198v16" stroke="rgb(var(--brand))" strokeWidth="2.5" strokeLinecap="round" />

      <circle className="website-info-art__intro-spark website-info-art__intro-spark--1" cx="54" cy="124" r="4" fill="rgb(var(--brand))" />

      <path className="website-info-art__intro-spark website-info-art__intro-spark--2" d="M356 148l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="rgb(var(--brand))" />

      <path className="website-info-art__intro-spark website-info-art__intro-spark--3" d="M138 62l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3Z" fill="rgb(var(--brand))" />

    </svg>

  );

}



function WebsiteLaunchIllustration() {

  return (

    <svg

      viewBox="0 0 420 320"

      className="website-info-section__art-svg website-info-section__art-svg--guide"

      fill="none"

      aria-hidden

    >

      <ellipse className="website-info-art__guide-shadow" cx="210" cy="286" rx="92" ry="9" fill="rgb(var(--brand) / 0.12)" />

      <circle className="website-info-art__guide-signal website-info-art__guide-signal--1" cx="210" cy="160" r="108" stroke="rgb(var(--brand) / 0.14)" strokeWidth="2" />

      <circle className="website-info-art__guide-signal website-info-art__guide-signal--2" cx="210" cy="160" r="88" stroke="rgb(var(--brand) / 0.18)" strokeWidth="2" />

      <circle className="website-info-art__guide-signal website-info-art__guide-signal--3" cx="210" cy="160" r="68" stroke="rgb(var(--brand) / 0.22)" strokeWidth="2" />

      <rect className="website-info-art__guide-phone" x="118" y="42" width="184" height="236" rx="22" fill="rgb(var(--bg-elevated))" stroke="rgb(var(--brand) / 0.35)" strokeWidth="3" />

      <rect className="website-info-art__guide-notch" x="176" y="54" width="68" height="8" rx="4" fill="rgb(var(--brand) / 0.18)" />

      <rect className="website-info-art__guide-header" x="136" y="68" width="148" height="24" rx="6" fill="rgb(var(--brand) / 0.18)" />

      <rect className="website-info-art__guide-line website-info-art__guide-line--1" x="136" y="108" width="112" height="10" rx="4" fill="rgb(var(--foreground-muted) / 0.2)" />

      <rect className="website-info-art__guide-line website-info-art__guide-line--2" x="136" y="128" width="96" height="10" rx="4" fill="rgb(var(--foreground-muted) / 0.15)" />

      <rect className="website-info-art__guide-line website-info-art__guide-line--3" x="136" y="148" width="120" height="10" rx="4" fill="rgb(var(--foreground-muted) / 0.15)" />

      <circle className="website-info-art__guide-check website-info-art__guide-check--1" cx="148" cy="178" r="8" fill="rgb(var(--brand) / 0.2)" stroke="rgb(var(--brand))" strokeWidth="2" />

      <path className="website-info-art__guide-check-mark website-info-art__guide-check-mark--1" d="M144 178l3 3 6-7" stroke="rgb(var(--brand))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      <circle className="website-info-art__guide-check website-info-art__guide-check--2" cx="148" cy="202" r="8" fill="rgb(var(--brand) / 0.16)" stroke="rgb(var(--brand) / 0.7)" strokeWidth="2" />

      <path className="website-info-art__guide-check-mark website-info-art__guide-check-mark--2" d="M144 202l3 3 6-7" stroke="rgb(var(--brand))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      <path className="website-info-art__guide-rocket" d="M210 188 236 132l26 56Z" fill="rgb(var(--brand) / 0.28)" />

      <path className="website-info-art__guide-rocket-flame" d="M236 214v18M228 224h16" stroke="rgb(var(--brand))" strokeWidth="3" strokeLinecap="round" />

      <path className="website-info-art__guide-rocket-cross" d="M236 120v28M224 134h24" stroke="rgb(var(--brand))" strokeWidth="3" strokeLinecap="round" />

      <path className="website-info-art__guide-trail" d="M236 232c-8 10-16 14-24 12" stroke="rgb(var(--brand) / 0.45)" strokeWidth="3" strokeLinecap="round" />

      <circle className="website-info-art__guide-side-badge" cx="88" cy="214" r="24" fill="rgb(var(--brand) / 0.14)" stroke="rgb(var(--brand) / 0.35)" strokeWidth="2" />

      <path className="website-info-art__guide-side-plus" d="M78 214h20M88 204v20" stroke="rgb(var(--brand))" strokeWidth="2.5" strokeLinecap="round" />

      <rect className="website-info-art__guide-chart" x="318" y="188" width="56" height="44" rx="8" fill="rgb(var(--brand) / 0.12)" stroke="rgb(var(--brand) / 0.28)" strokeWidth="2" />

      <rect className="website-info-art__guide-chart-bar website-info-art__guide-chart-bar--1" x="328" y="214" width="8" height="12" rx="2" fill="rgb(var(--brand))" />

      <rect className="website-info-art__guide-chart-bar website-info-art__guide-chart-bar--2" x="340" y="206" width="8" height="20" rx="2" fill="rgb(var(--brand))" />

      <rect className="website-info-art__guide-chart-bar website-info-art__guide-chart-bar--3" x="352" y="198" width="8" height="28" rx="2" fill="rgb(var(--brand))" />

      <circle className="website-info-art__guide-spark website-info-art__guide-spark--1" cx="72" cy="96" r="5" fill="rgb(var(--brand))" />

      <path className="website-info-art__guide-spark website-info-art__guide-spark--2" d="M360 96l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="rgb(var(--brand))" />

      <circle className="website-info-art__guide-orbit website-info-art__guide-orbit--1" cx="356" cy="248" r="6" fill="rgb(var(--brand))" />

      <circle className="website-info-art__guide-orbit website-info-art__guide-orbit--2" cx="62" cy="148" r="5" fill="rgb(var(--brand) / 0.7)" />

      <circle className="website-info-art__guide-orbit website-info-art__guide-orbit--3" cx="372" cy="176" r="4" fill="rgb(var(--brand) / 0.55)" />

    </svg>

  );

}



type WebsiteInfoSectionsProps = {

  introSection: WebsiteIntroSection;

  guideSection: WebsiteGuideSection;

};



export function WebsiteInfoSections({

  introSection,

  guideSection,

}: WebsiteInfoSectionsProps) {

  return (

    <div className="website-info-sections">

      <section className="website-info-section website-info-section--intro">

        <h2 className="website-info-section__heading">{introSection.title}</h2>

        <div className="website-info-section__grid">

          <div className="website-info-section__copy">

            <div className="website-info-section__steps website-info-section__intro-steps">

              {introSection.paragraphs.map((paragraph, index) => (

                <article key={paragraph} className="website-info-section__step">

                  <IntroParagraphIcon paragraphIndex={index} />

                  <div className="website-info-section__step-content">

                    <p className="website-info-section__paragraph">{paragraph}</p>

                  </div>

                </article>

              ))}

            </div>

          </div>

          <div className="website-info-section__art">

            <WebsiteInfoArtStage variant="intro" />

            <WebsiteDevIllustration />

          </div>

        </div>

      </section>



      <section className="website-info-section website-info-section--guide">

        <div className="website-info-section__grid website-info-section__grid--reverse">

          <div className="website-info-section__art website-info-section__art--guide">

            <WebsiteInfoArtStage variant="guide" />

            <WebsiteLaunchIllustration />

          </div>

          <div className="website-info-section__copy">

            <h2 className="website-info-section__guide-title">

              {guideSection.title}

            </h2>

            <div className="website-info-section__steps">

              {guideSection.steps.map((step, index) => (

                <article

                  key={`${step.number}-${step.title}`}

                  className="website-info-section__step"

                >

                  <GuideStepIcon stepIndex={index} />

                  <div className="website-info-section__step-content">

                    <p className="website-info-section__step-number">

                      {step.number}. {step.title}

                    </p>

                    <p className="website-info-section__step-body">{step.body}</p>

                  </div>

                </article>

              ))}

            </div>

          </div>

        </div>

      </section>

    </div>

  );

}


