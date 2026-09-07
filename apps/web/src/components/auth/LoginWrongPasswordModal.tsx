"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/admin/icons";
import { AUTH_WRONG_PASSWORD_MESSAGE } from "@/lib/auth-messages";

type Props = {
  open: boolean;
  email?: string;
  message?: string;
  onClose: () => void;
  onTryAgain: () => void;
  onUseEmailCode: () => void;
};

export function LoginWrongPasswordModal({
  open,
  email,
  message,
  onClose,
  onTryAgain,
  onUseEmailCode,
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

  const body = message?.trim() || AUTH_WRONG_PASSWORD_MESSAGE;

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
        aria-labelledby="login-wrong-password-title"
        aria-describedby="login-wrong-password-desc"
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
                <rect
                  className="login-no-account-icon-head"
                  x="5"
                  y="11"
                  width="14"
                  height="10"
                  rx="2"
                />
                <path
                  className="login-no-account-icon-body"
                  d="M8 11V8a4 4 0 0 1 8 0v3"
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
            id="login-wrong-password-title"
            className="login-no-account-modal__title"
          >
            Wrong password
          </p>
          <p
            id="login-wrong-password-desc"
            className="login-no-account-modal__text"
          >
            {body}
          </p>
          {email?.trim() ? (
            <p className="login-no-account-modal__email">{email.trim()}</p>
          ) : null}

          <div className="login-no-account-modal__actions">
            <button
              type="button"
              className="btn-primary login-no-account-modal__cta"
              onClick={onTryAgain}
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
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              Try Again
            </button>
            <button
              type="button"
              className="btn-secondary login-no-account-modal__dismiss"
              onClick={onUseEmailCode}
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
              Use Email Code
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
