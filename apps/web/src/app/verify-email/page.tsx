"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { resendVerification, setTokens, verifyEmail } from "@/lib/api";
import { attachStoredReferral } from "@/lib/affiliate-ref";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { useRouter } from "next/navigation";

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qEmail = params.get("email");
    if (qEmail) setEmail(qEmail);
  }, []);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const code = digits.join("");
  const isComplete = code.length === CODE_LENGTH && digits.every((d) => d !== "");

  function handleDigitChange(index: number, value: string) {
    // Allow paste of full code
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

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await verifyEmail(email, code);
      setTokens(res.accessToken, res.csrfToken ?? res.refreshToken, {
        roles: res.user?.roles,
        expiresIn: res.expiresIn,
      });
      await attachStoredReferral();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
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
      const captcha = await getRecaptchaToken("resend_verification");
      const res = await resendVerification(email, captcha);
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
      {/* Icon */}
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
        <svg
          className="h-8 w-8 text-brand"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
      <p className="mt-2 text-center text-sm text-foreground-muted">
        We sent a 6-digit code to{" "}
        <span className="font-medium text-foreground">{email || "your email"}</span>.
        <br />
        Enter it below to activate your account.
      </p>

      {error && (
        <div className="mt-5 w-full rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}
      {info && (
        <div className="mt-5 w-full rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          {info}
        </div>
      )}

      {/* 6-digit code input */}
      <form onSubmit={onVerify} className="mt-7 w-full">
        <div className="flex justify-center gap-2 sm:gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
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

        <button
          type="submit"
          disabled={!isComplete || loading}
          className="btn-primary mt-6 w-full disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify & Continue"}
        </button>
      </form>

      {/* Resend */}
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
        Wrong email?{" "}
        <Link
          href="/register"
          className="font-semibold text-brand hover:underline"
        >
          Go back
        </Link>
      </p>
    </main>
  );
}
