"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/admin/icons";
import { ContactEmailForm } from "@/components/contact/ContactEmailForm";
import { CONTACT_EMAIL_OPEN_EVENT } from "@/components/contact/ContactSocialIconRow";

type ContactEmailPopupProps = {
  listenForOpen?: boolean;
  disableOnContactPage?: boolean;
};

export function ContactEmailPopup({
  listenForOpen = true,
  disableOnContactPage = false,
}: ContactEmailPopupProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const shouldListen =
    listenForOpen && !(disableOnContactPage && pathname === "/contact");

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!shouldListen) return;

    const openPopup = () => setOpen(true);
    window.addEventListener(CONTACT_EMAIL_OPEN_EVENT, openPopup);
    return () => window.removeEventListener(CONTACT_EMAIL_OPEN_EVENT, openPopup);
  }, [shouldListen]);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="contact-email-popup" role="presentation">
      <button
        type="button"
        className="contact-email-popup__backdrop"
        aria-label="Close dialog"
        onClick={close}
      />
      <div
        className="contact-email-popup__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-email-popup-title"
      >
        <div className="contact-email-popup__accent" aria-hidden />
        <button
          type="button"
          className="contact-email-popup__close"
          onClick={close}
          aria-label="Close"
        >
          <CloseIcon className="h-5 w-5" aria-hidden />
        </button>
        <div className="contact-email-popup__body">
          <ContactEmailForm
            className="border-0 bg-transparent p-0 shadow-none sm:p-0"
            headingId="contact-email-popup-title"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
