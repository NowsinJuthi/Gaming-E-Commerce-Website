"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/admin/icons";
import { AUTH_NO_ACCOUNT_MESSAGE } from "@/lib/auth-messages";

type Props = {
  open: boolean;
  email?: string;
  message?: string;
  onClose: () => void;
};

export function LoginNoAccountModal({
  open,
  email,
  message,
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

  const body = message?.trim() || AUTH_NO_ACCOUNT_MESSAGE;

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
        aria-labelledby="login-no-account-title"
        aria-describedby="login-no-account-desc"
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
                <circle className="login-no-account-icon-head" cx="12" cy="8" r="4" />
                <path
                  className="login-no-account-icon-body"
                  d="M6 20v-1a6 6 0 0 1 12 0v1"
                />
                <path
                  className="login-no-account-icon-mark"
                  strokeLinecap="round"
                  d="M4 4l16 16"
                />
              </svg>
            </span>
          </div>

          <p
            id="login-no-account-title"
            className="login-no-account-modal__title"
          >
            Account Not Found
          </p>
          <p
            id="login-no-account-desc"
            className="login-no-account-modal__text"
          >
            {body}
          </p>
          {email?.trim() ? (
            <p className="login-no-account-modal__email">{email.trim()}</p>
          ) : null}

          <div className="login-no-account-modal__actions">
            <Link
              href="/register"
              className="btn-primary login-no-account-modal__cta"
              onClick={onClose}
            >
              <svg
                viewBox="0 0 24 24"
                className="login-no-account-modal__cta-icon"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8v6" />
                <path d="M22 11h-6" />
              </svg>
              Create An Account
            </Link>
            <button
              type="button"
              className="btn-secondary login-no-account-modal__dismiss"
              onClick={onClose}
            >
              <svg
                viewBox="0 0 24 24"
                className="login-no-account-modal__dismiss-icon"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4 7h16v11H4z" />
                <path d="m4 7 8 5.5L20 7" />
                <path d="M12 12.5V17" />
                <path d="M9.5 14.5 12 17l2.5-2.5" />
              </svg>
              Try Another Email
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
