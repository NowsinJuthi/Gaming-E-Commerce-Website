import { BlogHeroArt } from "@/components/blog/BlogHeroArt";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";

function BookIcon({ className }: { className?: string }) {
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
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  );
}

function splitHeading(raw: string): { head: string; tail: string } {
  const text = raw.trim().replace(/\.+$/, "") || "UniQbd Blog";
  const words = text.split(/\s+/);
  if (words.length < 2) return { head: text, tail: "" };
  const cut = Math.max(1, words.length - 1);
  return {
    head: words.slice(0, cut).join(" "),
    tail: words.slice(cut).join(" "),
  };
}

type Props = {
  heading: string;
  description?: string;
  badge?: string;
  searchQuery?: string;
};

export function BlogHeroPanel({
  heading,
  description,
  badge = "Blog Center",
  searchQuery,
}: Props) {
  const title = splitHeading(heading);

  return (
    <section className="blog-hero-panel" aria-label="Blog introduction">
      <MarketingHeroBubbles />
      <span className="blog-hero-panel__glow blog-hero-panel__glow--1" aria-hidden />
      <span className="blog-hero-panel__glow blog-hero-panel__glow--2" aria-hidden />

      <div className="blog-hero-panel__content">
        <div className="blog-hero-panel__layout">
          <div className="blog-hero-panel__main">
            <div className="blog-hero-panel__header">
              <span className="blog-hero-panel__badge dashboard-pro-status dashboard-pro-status--brand">
                <BookIcon className="h-3.5 w-3.5 shrink-0" />
                {badge}
              </span>

              <h1 className="blog-hero-panel__title">
                {title.head}
                {title.tail ? (
                  <>
                    {" "}
                    <span className="blog-hero-panel__accent">{title.tail}.</span>
                  </>
                ) : (
                  "."
                )}
              </h1>
            </div>

            {description?.trim() ? (
              <p className="blog-hero-panel__subheading">{description}</p>
            ) : null}

            {searchQuery ? (
              <p className="blog-hero-panel__search-hint">
                Showing results for <strong>&ldquo;{searchQuery}&rdquo;</strong>
              </p>
            ) : null}
          </div>

          <BlogHeroArt className="blog-hero-panel__art" />
        </div>
      </div>
    </section>
  );
}
