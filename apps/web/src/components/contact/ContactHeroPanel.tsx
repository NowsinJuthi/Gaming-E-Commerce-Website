import type { ContactSettings, PublicSeoConfig } from "@/lib/api";
import { ContactHeroArt } from "@/components/contact/ContactHeroArt";
import { ContactSocialIconRow } from "@/components/contact/ContactSocialIconRow";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function splitHeading(raw: string): { head: string; tail: string } {
  const text = raw.trim().replace(/\.+$/, "") || "Keep In Touch With Us";
  const words = text.split(/\s+/);
  if (words.length < 3) return { head: text, tail: "" };
  const cut = Math.max(1, words.length - 2);
  return {
    head: words.slice(0, cut).join(" "),
    tail: words.slice(cut).join(" "),
  };
}

export function ContactHeroPanel({
  data,
  seo,
}: {
  data: ContactSettings;
  seo: PublicSeoConfig;
}) {
  const heading = splitHeading(data.heading || "Keep In Touch With Us");

  return (
    <section className="contact-hero-panel" aria-label="Contact support center">
      <MarketingHeroBubbles />
      <span className="contact-hero-panel__glow contact-hero-panel__glow--1" aria-hidden />
      <span className="contact-hero-panel__glow contact-hero-panel__glow--2" aria-hidden />

      <div className="contact-hero-panel__content">
        <div className="contact-hero-panel__layout">
          <div className="contact-hero-panel__main">
            <div className="contact-hero-panel__header">
              <span className="contact-hero-panel__badge dashboard-pro-status dashboard-pro-status--brand">
                <MailIcon className="h-3.5 w-3.5 shrink-0" />
                Support Center
              </span>

              <h1 className="contact-hero-panel__title">
                {heading.head}
                {heading.tail ? (
                  <>
                    {" "}
                    <span className="contact-hero-panel__accent">{heading.tail}.</span>
                  </>
                ) : (
                  "."
                )}
              </h1>
            </div>

            <div className="contact-hero-panel__copy">
              {data.subheading?.trim() ? (
                <p className="contact-hero-panel__subheading">{data.subheading}</p>
              ) : null}

              <div className="contact-hero-panel__meta">
                <p className="contact-hero-panel__meta-item">
                  <ClockIcon className="h-4 w-4 text-brand" />
                  Average Response Time:{" "}
                  <strong className="text-foreground">&lt; 15 minutes</strong>
                </p>
                {data.extraText?.trim() ? (
                  <p className="contact-hero-panel__meta-note">{data.extraText}</p>
                ) : null}
              </div>
            </div>
          </div>

          <ContactHeroArt className="contact-hero-panel__art" />
        </div>

        <div className="contact-hero-panel__footer">
          <p className="contact-hero-panel__credit">
            Developed by <span className="contact-hero-panel__brand">UniQbd</span>{" "}
            Team @ 2020.
          </p>

          <ContactSocialIconRow
            contact={data}
            seo={seo}
            align="end"
            emailBehavior="open-form"
          />
        </div>
      </div>
    </section>
  );
}
