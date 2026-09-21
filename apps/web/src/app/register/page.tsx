"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getRegistrationEmailPolicy, registerUser } from "@/lib/api";
import { getRecaptchaToken, warmupRecaptcha } from "@/lib/recaptcha";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from "@/lib/password-rules";
import {
  LoginFieldKeyIcon,
  LoginFieldMailIcon,
  LoginSubmitIcon,
  RegisterAnimatedIcon,
  SignUpButtonIcon,
} from "@/components/auth/LoginAnimatedIcon";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";
import { EyeIcon } from "@/components/admin/icons";

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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allowlistActive, setAllowlistActive] = useState(false);

  const inputClass = "input-field";

  useEffect(() => {
    warmupRecaptcha();
    getRegistrationEmailPolicy()
      .then((policy) => setAllowlistActive(Boolean(policy.allowlistEnabled)))
      .catch(() => setAllowlistActive(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const captcha = await getRecaptchaToken("register");
      const res = await registerUser(email, password, captcha);
      router.push(`/verify-email?email=${encodeURIComponent(res.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <MarketingHeroBubbles />

      <div className="login-page__inner">
        <div className="login-page__card">
          <RegisterAnimatedIcon />

          <header className="login-page__header">
            <h1 className="login-page__title">Create Your Account</h1>
            <p className="login-page__subtitle">
              Join UniQbd and start shopping digital goods in seconds.
            </p>
            {allowlistActive ? (
              <p className="login-page__hint mt-2 text-center">
                Only approved email providers can register.
              </p>
            ) : null}
          </header>

          {error && (
            <div className="login-page__alert login-page__alert--error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="login-page__form">
            <div>
              <label className="login-page__label" htmlFor="register-email">
                Email
              </label>
              <div className="login-page__field">
                <LoginFieldMailIcon className="login-page__field-icon" />
                <input
                  id="register-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} login-page__input`}
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="login-page__label" htmlFor="register-password">
                Password
              </label>
              <div className="login-page__field">
                <LoginFieldKeyIcon className="login-page__field-icon" />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              <p className="login-page__hint">{PASSWORD_HINT}</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {!loading ? <SignUpButtonIcon /> : null}
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>

          <div className="login-page__signup">
            <div className="login-page__signup-icon">
              <LoginSubmitIcon className="h-5 w-5" />
            </div>
            <p className="login-page__signup-text">Already have an account?</p>
            <Link href="/login" className="btn-secondary login-page__signup-btn">
              <LoginSubmitIcon />
              Log in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
