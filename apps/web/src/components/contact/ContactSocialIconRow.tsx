"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ContactSettings, PublicSeoConfig } from "@/lib/api";
import {
  normalizeDiscordUrl,
  normalizeTelegramUrl,
  normalizeWhatsAppUrl,
} from "@/components/SocialMediaLinks";
import {
  buildLoginRedirectUrl,
  useRegisteredLogin,
} from "@/hooks/use-registered-login";

const DEFAULT_SUPPORT_EMAIL = "support@uniqbd.com";
export const CONTACT_EMAIL_OPEN_EVENT = "contact-email:open";
type SocialItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4"
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 7.01 2.962a9.827 9.827 0 012.923 7.01c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037 12.3 12.3 0 0 0-.608 1.25 18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function findLinkByKeyword(
  links: ContactSettings["social"]["links"],
  keywords: string[],
): string {
  const match = links.find((item) => {
    const haystack = `${item.text} ${item.url}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
  return match?.url?.trim() ?? "";
}

function resolveTelegramUrl(
  links: ContactSettings["social"]["links"],
): string {
  const keywordMatch = normalizeTelegramUrl(
    findLinkByKeyword(links, ["telegram", "t.me"]),
  );
  if (keywordMatch) return keywordMatch;

  for (const link of links) {
    const normalized = normalizeTelegramUrl(link.url);
    if (normalized) return normalized;
  }

  return "";
}

function resolveDiscordUrl(
  contact: ContactSettings,
  seo?: Pick<PublicSeoConfig, "social"> | null,
): string {
  const seoDiscord = normalizeDiscordUrl(seo?.social.discord);
  if (seoDiscord) return seoDiscord;

  const keywordMatch = normalizeDiscordUrl(
    findLinkByKeyword(contact.social.links, ["discord", "discord.gg"]),
  );
  if (keywordMatch) return keywordMatch;

  for (const link of contact.social.links) {
    const normalized = normalizeDiscordUrl(link.url);
    if (normalized) return normalized;
  }

  return "";
}

export function buildContactSocialItems(
  contact: ContactSettings,
  seo?: Pick<PublicSeoConfig, "social"> | null,
): SocialItem[] {
  const email =
    contact.email.emails.find((item) => item.trim())?.trim() ||
    DEFAULT_SUPPORT_EMAIL;
  const facebook =
    contact.social.facebookUrl.trim() || seo?.social.facebook.trim() || "";
  const youtube =
    contact.social.youtubeUrl.trim() || seo?.social.youtube.trim() || "";
  const whatsapp = normalizeWhatsAppUrl(contact.social.whatsappUrl);
  const discord = resolveDiscordUrl(contact, seo);
  const telegram = resolveTelegramUrl(contact.social.links);
  const fallback = "/support";

  return [
    {
      id: "facebook",
      label: "Facebook",
      href: facebook || fallback,
      icon: <FacebookIcon />,
    },
    {
      id: "email",
      label: "Email",
      href: `mailto:${email}`,
      icon: <MailIcon />,
    },
    {
      id: "youtube",
      label: "YouTube",
      href: youtube || fallback,
      icon: <YouTubeIcon />,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: whatsapp || fallback,
      icon: <WhatsAppIcon />,
    },
    {
      id: "discord",
      label: "Discord",
      href: discord || fallback,
      icon: <DiscordIcon />,
    },
    {
      id: "telegram",
      label: "Telegram",
      href: telegram || fallback,
      icon: <TelegramIcon />,
    },
  ];
}

export function ContactSocialIconRow({
  contact,
  seo,
  className = "",
  align = "start",
  emailBehavior = "mailto",
}: {
  contact: ContactSettings;
  seo?: Pick<PublicSeoConfig, "social"> | null;
  className?: string;
  align?: "start" | "end" | "center";
  emailBehavior?: "mailto" | "open-form";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const loggedIn = useRegisteredLogin();
  const items = buildContactSocialItems(contact, seo);
  const loginUrl = buildLoginRedirectUrl(pathname || "/");
  const whatsappHref = normalizeWhatsAppUrl(contact.social.whatsappUrl);
  const telegramHref = resolveTelegramUrl(contact.social.links);
  const alignClass =
    align === "end"
      ? "contact-social-icon-row--end"
      : align === "center"
        ? "contact-social-icon-row--center"
        : "contact-social-icon-row--start";

  const openEmailForm = () => {
    window.dispatchEvent(new Event(CONTACT_EMAIL_OPEN_EVENT));
  };

  const openWhatsApp = () => {
    if (!whatsappHref) return;
    if (!loggedIn) {
      router.push(loginUrl);
      return;
    }
    window.open(whatsappHref, "_blank", "noopener,noreferrer");
  };

  const openTelegram = () => {
    if (!telegramHref) return;
    window.open(telegramHref, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`contact-social-icon-row ${alignClass} ${className}`.trim()}>
      <div className="about-intro-panel__social">
        {items.map((item, index) => {
          const isExternal =
            item.id !== "email" && /^https?:\/\//i.test(item.href);
          const sharedClassName = "about-intro-panel__social-link";
          const sharedStyle = { animationDelay: `${0.1 + index * 0.08}s` };

          if (item.id === "email" && emailBehavior === "open-form") {
            return (
              <button
                key={item.id}
                type="button"
                onClick={openEmailForm}
                className={sharedClassName}
                aria-label={item.label}
                style={sharedStyle}
              >
                <span className="about-intro-panel__social-ring" aria-hidden />
                {item.icon}
              </button>
            );
          }

          if (item.id === "whatsapp" && whatsappHref) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={openWhatsApp}
                className={sharedClassName}
                aria-label={item.label}
                style={sharedStyle}
              >
                <span className="about-intro-panel__social-ring" aria-hidden />
                {item.icon}
              </button>
            );
          }

          if (item.id === "telegram" && telegramHref) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={openTelegram}
                className={sharedClassName}
                aria-label={item.label}
                style={sharedStyle}
              >
                <span className="about-intro-panel__social-ring" aria-hidden />
                {item.icon}
              </button>
            );
          }

          return (
            <a
              key={item.id}
              href={item.href}
              className={sharedClassName}
              aria-label={item.label}
              style={sharedStyle}
              {...(isExternal
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              <span className="about-intro-panel__social-ring" aria-hidden />
              {item.icon}
            </a>
          );
        })}
      </div>
    </div>
  );
}