"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizeWhatsAppUrl } from "@/components/SocialMediaLinks";
import {
  FabChatBubbleIcon,
  LiveChatAnimatedIconBadge,
} from "@/components/chat/FabChatBubbleIcon";
import { ContactEmailForm } from "@/components/contact/ContactEmailForm";
import { CONTACT_EMAIL_OPEN_EVENT } from "@/components/contact/ContactSocialIconRow";
import {
  buildLoginRedirectUrl,
  useRegisteredLogin,
} from "@/hooks/use-registered-login";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 7.01 2.962a9.827 9.827 0 012.923 7.01c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

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

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

/**
 * "Send a Message" card body → live chat launcher. Only registered users can
 * chat; guests are sent to the login page and returned here after signing in.
 */
export function LiveChatCard() {
  const router = useRouter();
  const pathname = usePathname();
  const loggedIn = useRegisteredLogin();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const loginUrl = buildLoginRedirectUrl(pathname || "/contact");

  useEffect(() => {
    const openEmailForm = () => {
      setShowEmailForm(true);
      requestAnimationFrame(() => {
        document.getElementById("contact-live-chat-card")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    };

    window.addEventListener(CONTACT_EMAIL_OPEN_EVENT, openEmailForm);
    return () => {
      window.removeEventListener(CONTACT_EMAIL_OPEN_EVENT, openEmailForm);
    };
  }, []);

  const startChat = () => {
    if (!loggedIn) {
      router.push(loginUrl);
      return;
    }
    window.dispatchEvent(new Event("live-chat:open"));
  };

  return (
    <div
      id="contact-live-chat-card"
      className="contact-option-card scroll-mt-24 flex h-full flex-col rounded-2xl border border-border/60 bg-elevated p-4 shadow-card sm:p-8"
    >
      {showEmailForm ? (
        <>
          <ContactEmailForm className="border-0 bg-transparent p-0 shadow-none sm:p-0" />
          <div className="contact-back-live-chat-wrap">
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="contact-back-live-chat-btn"
            >
              <span className="contact-back-live-chat-btn__arrow" aria-hidden>
                ←
              </span>
              <span className="contact-back-live-chat-btn__icon" aria-hidden>
                <FabChatBubbleIcon className="h-4 w-4" animated />
              </span>
              <span className="contact-back-live-chat-btn__label">
                Back to Live Chat
              </span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="contact-live-chat-icon contact-live-chat-icon--sm shrink-0">
              <span className="live-chat-guest-prompt-icon-ring" aria-hidden />
              <span className="live-chat-guest-prompt-icon">
                <FabChatBubbleIcon className="h-7 w-7" animated />
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                Live Chat
              </h2>
              <p className="text-sm text-foreground-muted">
                Let&apos;s ask your questions
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-surface/60 px-3 py-8 text-center sm:px-6 sm:py-10">
            <LiveChatAnimatedIconBadge />
            <p className="mt-4 text-base font-semibold text-foreground">
              Chat with our support team in real time
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-foreground-muted">
              {loggedIn
                ? "Start a conversation and we'll reply as fast as we can — you'll also get an email if you miss our reply."
                : "Sign in to your account to start a live chat conversation with our support team."}
            </p>
            <div className="about-cta-actions mt-6">
              <button
                type="button"
                onClick={startChat}
                className="btn-primary about-cta-btn"
              >
                <FabChatBubbleIcon className="h-5 w-5 shrink-0" animated />
                {loggedIn ? "Start Live Chat" : "Sign in to Chat"}
              </button>
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="btn-secondary about-cta-btn"
              >
                <MailIcon className="h-5 w-5 shrink-0" />
                Send Us An Email
              </button>
            </div>
            {!loggedIn ? (
              <p className="mt-3 text-xs text-subtle">
                You&apos;ll be brought right back here after signing in.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "Connect Directly" WhatsApp card. The button only works for registered
 * users; guests are redirected to the login page. Title/description are
 * editable in Admin → Settings → Contact.
 */
export function WhatsAppCard({
  whatsappUrl,
  title,
  description,
}: {
  whatsappUrl: string;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const loggedIn = useRegisteredLogin();
  const href = normalizeWhatsAppUrl(whatsappUrl);
  const loginUrl = buildLoginRedirectUrl(pathname || "/contact");

  if (!href) return null;

  const openWhatsApp = () => {
    if (!loggedIn) {
      router.push(loginUrl);
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const fallbackDescription = loggedIn
    ? "Chat with our support executives instantly via WhatsApp."
    : "Sign in to chat with our support executives via WhatsApp.";

  return (
    <div className="contact-option-card rounded-2xl border border-border/60 bg-elevated px-3 py-5 text-center shadow-card sm:px-6 sm:py-7">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-brand/15 text-brand">
        <WhatsAppIcon className="h-9 w-9" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-foreground">
        {title?.trim() || "Connect Directly"}
      </h3>
      <p className="mt-1.5 text-sm text-foreground-muted">
        {description?.trim() || fallbackDescription}
      </p>
      <button
        type="button"
        onClick={openWhatsApp}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand"
      >
        {loggedIn ? "Chat on WhatsApp" : "Sign in to WhatsApp"}
        <ExternalLinkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
