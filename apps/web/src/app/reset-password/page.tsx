"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  requestPasswordReset,
  resetPasswordWithCode,
} from "@/lib/api";
import { getRecaptchaToken, warmupRecaptcha } from "@/lib/recaptcha";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from "@/lib/password-rules";

const CODE_LENGTH = 6;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    warmupRecaptcha();
    const qEmail = searchParams.get("email");
    if (qEmail) setEmail(qEmail);
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const code = digits.join("");
  const isCodeComplete =
    code.length === CODE_LENGTH && digits.every((d) => d !== "");

  function handleDigitChange(index: number, value: string) {
    if (value.length > 1) {
      const cleaned = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
      const next = Array(CODE_LENGTH).fill("");
      for (let i = 0; i < cleaned.length; i++) next[i] = cleaned[i];
      setDigits(next);
      const focusIdx = Math.min(cleaned.length, CODE_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    const digit = value.replace(/\D/g, "");
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isCodeComplete) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithCode(email, code, password);
      router.push("/login?reset=success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (resendCooldown > 0 || resending || !email) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const captcha = await getRecaptchaToken("password_reset_request");
      const res = await requestPasswordReset(email, captcha);
      setInfo(res.message);
      setResendCooldown(120);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
      if (err && typeof err === "object" && "retryAfterSeconds" in err) {
        const secs = (err as { retryAfterSeconds: number }).retryAfterSeconds;
        if (secs > 0) setResendCooldown(secs);
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
        <svg
          className="h-8 w-8 text-brand"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
      <p className="mt-2 text-center text-sm text-foreground-muted">
        Enter the 6-digit code sent to{" "}
        <span className="font-medium text-foreground">
          {email || "your email"}
        </span>{" "}
        and choose a new password.
      </p>

      {error && (
        <div className="mt-5 w-full rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}
      {info && (
        <div className="mt-5 w-full rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          {info}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-7 w-full space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field w-full"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Reset code</label>
          <div className="flex justify-center gap-2 sm:gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={CODE_LENGTH}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                className="h-14 w-11 rounded-xl border border-border bg-elevated text-center text-xl font-bold text-foreground caret-brand outline-none ring-0 transition focus:border-brand focus:ring-2 focus:ring-brand/30 sm:h-16 sm:w-12"
                aria-label={`Digit ${i + 1}`}
                autoComplete={i === 0 ? "one-time-code" : "off"}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">New password</label>
          <input
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field w-full"
          />
          <p className="mt-1 text-xs text-foreground-muted">{PASSWORD_HINT}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Confirm new password
          </label>
          <input
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field w-full"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? "Updating password…" : "Reset password"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-foreground-muted">
        Didn&apos;t receive a code?{" "}
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={resendCooldown > 0 || resending || !email}
          className="font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resending
            ? "Sending…"
            : resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend code"}
        </button>
      </div>

      <p className="mt-8 text-center text-sm text-foreground-muted">
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Back to login
        </Link>
      </p>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-md flex-col px-4 py-16">
          <p className="text-sm text-foreground-muted">Loading…</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
