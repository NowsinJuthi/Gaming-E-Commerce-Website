"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { attachStoredReferral } from "@/lib/affiliate-ref";
import {
  loginUser,
  requestOtp,
  setTokens,
  toApiError,
  verifyOtp,
} from "@/lib/api";
import { getPostLoginRedirect } from "@/lib/auth-roles";
import {
  AUTH_NO_ACCOUNT_MESSAGE,
  AUTH_WRONG_PASSWORD_MESSAGE,
  isAuthNoAccountError,
  isAuthWrongPasswordError,
} from "@/lib/auth-messages";
import { getRecaptchaToken, warmupRecaptcha } from "@/lib/recaptcha";
import { LoginNoAccountModal } from "@/components/auth/LoginNoAccountModal";
import { LoginWrongPasswordModal } from "@/components/auth/LoginWrongPasswordModal";
import {
  LoginAnimatedIcon,
  LoginFieldCodeIcon,
  LoginFieldKeyIcon,
  LoginFieldMailIcon,
  LoginSubmitIcon,
  LoginTabLockIcon,
  LoginTabMailIcon,
  SendLoginCodeIcon,
  SignUpButtonIcon,
  VerifyLoginIcon,
} from "@/components/auth/LoginAnimatedIcon";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import { EyeIcon } from "@/components/admin/icons";

type Mode = "password" | "otp";

type LoginFormProps = {
  nextPath?: string | null;
  resetSuccess?: boolean;
};

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

export function LoginForm({ nextPath, resetSuccess = false }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [noAccountOpen, setNoAccountOpen] = useState(false);
  const [noAccountMessage, setNoAccountMessage] = useState<string | null>(null);
  const [wrongPasswordOpen, setWrongPasswordOpen] = useState(false);
  const [wrongPasswordMessage, setWrongPasswordMessage] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    warmupRecaptcha();
  }, []);

  useEffect(() => {
    if (resetSuccess) {
      setInfo("Your password has been reset. Log in with your new password.");
    }
  }, [resetSuccess]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current!);
  }, [resendCooldown]);

  function resetMessages() {
    setError(null);
    setInfo(null);
    setNoAccountOpen(false);
    setNoAccountMessage(null);
    setWrongPasswordOpen(false);
    setWrongPasswordMessage(null);
  }

  function openNoAccountModal(message?: string | null) {
    const text = message?.trim() || AUTH_NO_ACCOUNT_MESSAGE;
    setNoAccountMessage(text);
    setNoAccountOpen(true);
    setError(text);
  }

  function closeWrongPasswordModal() {
    setWrongPasswordOpen(false);
    setWrongPasswordMessage(null);
  }

  function openWrongPasswordModal(message?: string | null) {
    const text = message?.trim() || AUTH_WRONG_PASSWORD_MESSAGE;
    setWrongPasswordMessage(text);
    setWrongPasswordOpen(true);
    setError(text);
  }

  function handleWrongPasswordTryAgain() {
    closeWrongPasswordModal();
    setPassword("");
    setShowPassword(false);
  }

  function handleWrongPasswordUseEmailCode() {
    closeWrongPasswordModal();
    setMode("otp");
    setPassword("");
    setCode("");
    setOtpSent(false);
    warmupRecaptcha();
  }

  function closeNoAccountModal() {
    setNoAccountOpen(false);
    setNoAccountMessage(null);
  }

  async function submitPasswordLogin() {
    if (loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("ইমেইল দিন।");
      return;
    }
    if (!password) {
      setError("Password দিন।");
      return;
    }

    setNoAccountOpen(false);
    setWrongPasswordOpen(false);
    setError(null);
    setLoading(true);

    try {
      const captcha = await getRecaptchaToken("login");
      const res = await loginUser(trimmedEmail, password, captcha);
      setTokens(res.accessToken, res.refreshToken);
      await attachStoredReferral();
      window.location.assign(
        getPostLoginRedirect(res.user.roles, res.accessToken, nextPath),
      );
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      const message =
        apiErr?.message ??
        (err instanceof Error ? err.message : "Login failed");

      if (
        err instanceof TypeError ||
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("network")
      ) {
        setError(
          "সার্ভারের সাথে সংযোগ হচ্ছে না। API চালু আছে কিনা দেখুন (http://localhost:4000/api)।",
        );
        return;
      }

      if (isAuthNoAccountError(err)) {
        openNoAccountModal(message || AUTH_NO_ACCOUNT_MESSAGE);
        return;
      }
      if (isAuthWrongPasswordError(err)) {
        openWrongPasswordModal(message || AUTH_WRONG_PASSWORD_MESSAGE);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function submitOtpRequest() {
    if (loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("ইমেইল দিন।");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const captcha = await getRecaptchaToken("otp_request");
      const res = await requestOtp(trimmedEmail, captcha);
      if (!res.accountExists) {
        openNoAccountModal(res.message);
        setOtpSent(false);
        return;
      }
      setOtpSent(true);
      setInfo(res.message);
      setResendCooldown(120);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not send code";
      if (err && typeof err === "object" && "retryAfterSeconds" in err) {
        const secs = (err as { retryAfterSeconds: number }).retryAfterSeconds;
        if (secs > 0) setResendCooldown(secs);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function submitOtpVerify() {
    if (loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !code.trim()) {
      setError("ইমেইল এবং ৬-digit code দিন।");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await verifyOtp(trimmedEmail, code.trim());
      setTokens(res.accessToken, res.refreshToken);
      await attachStoredReferral();
      window.location.assign(
        getPostLoginRedirect(res.user.roles, res.accessToken, nextPath),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  function handlePasswordFieldKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void submitPasswordLogin();
    }
  }

  const inputClass = "input-field";

  return (
    <>
      <main className="login-page">
        <MarketingHeroBubbles />

        <div className="login-page__inner">
          <div className="login-page__card">
            <LoginAnimatedIcon mode={mode} />

            <header className="login-page__header">
              <h1 className="login-page__title">Welcome back</h1>
              <p className="login-page__subtitle">
                {mode === "password"
                  ? "Sign in securely with your email and password."
                  : "Get a one-time code sent to your inbox — no password needed."}
              </p>
            </header>

            <div className="login-page__tabs" role="tablist" aria-label="Login method">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "password"}
                onClick={() => {
                  setMode("password");
                  resetMessages();
                }}
                className={`login-page__tab${
                  mode === "password" ? " login-page__tab--active" : ""
                }`}
              >
                <LoginTabLockIcon className="login-page__tab-icon" />
                Password
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "otp"}
                onClick={() => {
                  setMode("otp");
                  resetMessages();
                  warmupRecaptcha();
                }}
                className={`login-page__tab${
                  mode === "otp" ? " login-page__tab--active" : ""
                }`}
              >
                <LoginTabMailIcon className="login-page__tab-icon" />
                OTP / Email Code
              </button>
            </div>

            {error ? (
              <div className="login-page__alert login-page__alert--error" role="alert">
                {error}
              </div>
            ) : null}
            {info ? (
              <div className="login-page__alert login-page__alert--success" role="status">
                {info}
              </div>
            ) : null}

            {mode === "password" ? (
              <div className="login-page__form" role="form" aria-label="Password login">
                <div>
                  <label className="login-page__label" htmlFor="login-email">
                    Email
                  </label>
                  <div className="login-page__field">
                    <LoginFieldMailIcon className="login-page__field-icon" />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handlePasswordFieldKeyDown}
                      className={`${inputClass} login-page__input`}
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="login-page__label" htmlFor="login-password">
                    Password
                  </label>
                  <div className="login-page__field">
                    <LoginFieldKeyIcon className="login-page__field-icon" />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handlePasswordFieldKeyDown}
                      className={`${inputClass} login-page__input pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-foreground-muted transition hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOffIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <div className="login-page__forgot">
                    <Link
                      href={
                        email.trim()
                          ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
                          : "/forgot-password"
                      }
                      className="login-page__forgot-link"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void submitPasswordLogin()}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {!loading ? <LoginSubmitIcon /> : null}
                  {loading ? "Logging in…" : "Log in"}
                </button>
              </div>
            ) : (
              <div className="login-page__form" role="form" aria-label="Email code login">
                <div>
                  <label className="login-page__label" htmlFor="login-otp-email">
                    Email
                  </label>
                  <div className="login-page__field">
                    <LoginFieldMailIcon className="login-page__field-icon" />
                    <input
                      id="login-otp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={otpSent}
                      className={`${inputClass} login-page__input disabled:opacity-60`}
                      autoComplete="email"
                    />
                  </div>
                </div>
                {otpSent ? (
                  <div>
                    <label className="login-page__label" htmlFor="login-otp-code">
                      6-digit code
                    </label>
                    <div className="login-page__field">
                      <LoginFieldCodeIcon className="login-page__field-icon" />
                      <input
                        id="login-otp-code"
                        inputMode="numeric"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className={`${inputClass} login-page__input login-page__input--code`}
                        autoComplete="one-time-code"
                      />
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={loading || (!otpSent && resendCooldown > 0)}
                  onClick={() =>
                    void (otpSent ? submitOtpVerify() : submitOtpRequest())
                  }
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {!loading && otpSent ? <VerifyLoginIcon /> : null}
                  {!loading && !otpSent && resendCooldown <= 0 ? (
                    <SendLoginCodeIcon />
                  ) : null}
                  {loading
                    ? "Please wait…"
                    : otpSent
                      ? "Verify & log in"
                      : resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : "Send login code"}
                </button>
                {otpSent ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setCode("");
                      resetMessages();
                    }}
                    className="btn-ghost w-full text-sm"
                  >
                    Use a different email
                  </button>
                ) : null}
              </div>
            )}

            <div className="login-page__signup">
              <div className="login-page__signup-icon">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M19 8v6" />
                  <path d="M22 11h-6" />
                </svg>
              </div>
              <p className="login-page__signup-text">Don&apos;t have an account?</p>
              <Link
                href="/register"
                className="btn-secondary login-page__signup-btn"
              >
                <SignUpButtonIcon />
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </main>

      <LoginNoAccountModal
        open={noAccountOpen}
        email={email}
        message={noAccountMessage ?? undefined}
        onClose={closeNoAccountModal}
      />

      <LoginWrongPasswordModal
        open={wrongPasswordOpen}
        email={email}
        message={wrongPasswordMessage ?? undefined}
        onClose={closeWrongPasswordModal}
        onTryAgain={handleWrongPasswordTryAgain}
        onUseEmailCode={handleWrongPasswordUseEmailCode}
      />
    </>
  );
}
