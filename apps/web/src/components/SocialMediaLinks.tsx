function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 7.01 2.962a9.827 9.827 0 012.923 7.01c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export type SocialMediaUrls = {
  facebookUrl?: string;
  youtubeUrl?: string;
  whatsappUrl?: string;
};

/** Accepts wa.me links, api.whatsapp.com, or raw phone numbers. */
export function normalizeWhatsAppUrl(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) return raw;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;

  return `https://wa.me/${digits}`;
}

/** Accepts t.me links, @username, or bare Telegram handles. */
export function normalizeTelegramUrl(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^t\.me\//i.test(raw)) return `https://${raw}`;
  if (raw.startsWith("@")) return `https://t.me/${raw.slice(1)}`;
  if (/^[a-zA-Z0-9_]{3,}$/i.test(raw)) return `https://t.me/${raw}`;

  return "";
}

/** Accepts discord.gg invites, discord.com links, or bare invite codes. */
export function normalizeDiscordUrl(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^discord\.gg\//i.test(raw)) return `https://${raw}`;
  if (/^discord\.com\//i.test(raw)) return `https://${raw}`;
  if (/^discord\.gg\/[a-zA-Z0-9-]+$/i.test(raw)) return `https://${raw}`;
  if (/^[a-zA-Z0-9-]{2,}$/i.test(raw)) return `https://discord.gg/${raw}`;

  return "";
}

export function SocialMediaLinks({
  facebookUrl,
  youtubeUrl,
  whatsappUrl,
  className = "",
  size = "md",
}: SocialMediaUrls & {
  className?: string;
  size?: "sm" | "md";
}) {
  const facebook = facebookUrl?.trim();
  const youtube = youtubeUrl?.trim();
  const whatsapp = normalizeWhatsAppUrl(whatsappUrl);
  if (!facebook && !youtube && !whatsapp) return null;

  const buttonSize = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  const linkCls = `site-social-link inline-flex ${buttonSize} items-center justify-center rounded-full border border-border/60 bg-elevated text-foreground-muted transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand`;

  return (
    <div
      className={`site-social-links flex flex-wrap items-center gap-2.5 ${className}`}
    >
      {facebook ? (
        <a
          href={facebook}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
          aria-label="Facebook"
        >
          <FacebookIcon className={iconSize} />
        </a>
      ) : null}
      {youtube ? (
        <a
          href={youtube}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
          aria-label="YouTube"
        >
          <YouTubeIcon className={iconSize} />
        </a>
      ) : null}
      {whatsapp ? (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
          aria-label="WhatsApp"
        >
          <WhatsAppIcon className={iconSize} />
        </a>
      ) : null}
    </div>
  );
}
