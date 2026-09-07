"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/admin/icons";

type Props = {
  open: boolean;
  featureLabel?: string;
  onClose: () => void;
};

export function CustomerBlogAccessModal({
  open,
  featureLabel = "Blog",
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="login-no-account-modal" role="presentation">
      <button
        type="button"
        className="login-no-account-modal__backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className="login-no-account-modal__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="customer-blog-access-title"
        aria-describedby="customer-blog-access-desc"
      >
        <div className="login-no-account-modal__accent" aria-hidden />
        <button
          type="button"
          className="login-no-account-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon className="h-5 w-5" aria-hidden />
        </button>
        <div className="login-no-account-modal__body">
          <div className="login-no-account-modal__icon-wrap">
            <span className="login-no-account-modal__icon-ring" aria-hidden />
            <span className="login-no-account-modal__icon-shell">
              <svg
                viewBox="0 0 24 24"
                className="login-no-account-modal__icon-svg"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </span>
          </div>

          <p id="customer-blog-access-title" className="login-no-account-modal__title">
            {featureLabel} — Access Required
          </p>
          <p id="customer-blog-access-desc" className="login-no-account-modal__text">
            আপনার অ্যাকাউন্টে <strong className="text-foreground">{featureLabel}</strong>{" "}
            অ্যাক্সেসের পারমিশন নেই। এই ফিচার ব্যবহার করতে অ্যাডমিনিস্ট্রেটরের সাথে
            যোগাযোগ করুন।
          </p>

          <div className="login-no-account-modal__actions">
            <Link
              href="/support"
              className="btn-primary login-no-account-modal__cta"
              onClick={onClose}
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
