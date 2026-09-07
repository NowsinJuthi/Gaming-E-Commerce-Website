"use client";

type Mode = "password" | "otp";

export function LoginAnimatedIcon({ mode }: { mode: Mode }) {
  return (
    <div className="login-page-icon-wrap" aria-hidden>
      <span className="login-page-icon-ring" />
      <span className="login-page-icon-shell">
        <svg
          viewBox="0 0 24 24"
          className="login-page-icon-svg"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {mode === "password" ? (
            <>
              <rect
                className="login-page-icon-lock-body"
                x="5"
                y="11"
                width="14"
                height="10"
                rx="2"
              />
              <path
                className="login-page-icon-lock-shackle"
                d="M8 11V8a4 4 0 0 1 8 0v3"
              />
              <circle className="login-page-icon-lock-dot" cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
            </>
          ) : (
            <>
              <rect
                className="login-page-icon-mail-body"
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2.5"
              />
              <path
                className="login-page-icon-mail-flap"
                d="m3 7 9 6 9-6"
              />
              <path
                className="login-page-icon-mail-line"
                d="M8 13h8"
              />
            </>
          )}
        </svg>
      </span>
    </div>
  );
}

export function RegisterAnimatedIcon() {
  return (
    <div className="login-page-icon-wrap" aria-hidden>
      <span className="login-page-icon-ring" />
      <span className="login-page-icon-shell">
        <svg
          viewBox="0 0 24 24"
          className="login-page-icon-svg"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle className="login-page-icon-user-head" cx="9" cy="8" r="3.5" />
          <path
            className="login-page-icon-user-body"
            d="M5 20v-1.2a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4V20"
          />
          <path className="login-page-icon-user-plus-v" d="M19 8v6" />
          <path className="login-page-icon-user-plus-h" d="M22 11h-6" />
        </svg>
      </span>
    </div>
  );
}

export function LoginTabLockIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function LoginTabMailIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function LoginFieldMailIcon({ className = "" }: { className?: string }) {
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

export function LoginFieldKeyIcon({ className = "" }: { className?: string }) {
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
      <circle cx="8" cy="15" r="4" />
      <path d="M11.5 11.5 21 2" />
      <path d="M16 2h5v5" />
    </svg>
  );
}

export function LoginFieldCodeIcon({ className = "" }: { className?: string }) {
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
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h.01M15 9h.01M9 15h6" />
    </svg>
  );
}

const BTN_ICON = "h-4 w-4 shrink-0";

export function LoginSubmitIcon({ className = BTN_ICON }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17 15 12 10 7" />
      <path d="M15 12H3" />
    </svg>
  );
}

export function SendLoginCodeIcon({ className = BTN_ICON }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h16v11H4z" />
      <path d="m4 7 8 5.5L20 7" />
      <path d="M12 12.5V17" />
      <path d="M9.5 14.5 12 17l2.5-2.5" />
    </svg>
  );
}

export function VerifyLoginIcon({ className = BTN_ICON }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function SignUpButtonIcon({ className = BTN_ICON }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}
