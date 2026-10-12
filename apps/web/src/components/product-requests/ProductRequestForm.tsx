"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, submitProductRequest } from "@/lib/api";
import { isRegisteredUserLoggedIn } from "@/lib/guest-checkout";

type AuthState = "checking" | "authed";

function CheckCircleIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 12.2 2.4 2.4 4.8-5" />
    </svg>
  );
}

export function ProductRequestForm() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>("checking");
  const [productName, setProductName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login gate: guests are redirected to the login page.
  useEffect(() => {
    if (!isRegisteredUserLoggedIn()) {
      router.replace(`/login?next=${encodeURIComponent("/request-product")}`);
      return;
    }
    setAuth("authed");

    // Prefill from the account profile (best-effort).
    getMe()
      .then((me) => {
        setEmail((current) => current || me.email || "");
        setMobile((current) => current || me.phone || "");
        const name =
          me.profile?.displayName?.trim() ||
          [me.profile?.firstName, me.profile?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
        if (name) {
          setCustomerName((current) => current || name);
        }
      })
      .catch(() => undefined);
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitProductRequest({
        productName: productName.trim(),
        customerName: customerName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        details: details.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (auth === "checking") {
    return (
      <div className="rounded-2xl border border-border/60 bg-elevated px-6 py-12 text-center shadow-card">
        <p className="text-sm text-foreground-muted">Checking your account…</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-brand/30 bg-elevated px-6 py-12 text-center shadow-card">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
          <CheckCircleIcon className="h-8 w-8" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-foreground">
          Request submitted!
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-foreground-muted">
          Thanks for your request. Our team will review it and reply to your
          email as soon as possible.
        </p>
        <button
          type="button"
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-border/60 bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-brand/40"
          onClick={() => {
            setProductName("");
            setDetails("");
            setSubmitted(false);
          }}
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border/60 bg-elevated px-5 py-6 shadow-card sm:px-8 sm:py-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">
            Product Name <span className="text-brand">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={200}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Which product would you like us to add?"
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Your Name <span className="text-brand">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={120}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Email <span className="text-brand">*</span>
          </label>
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">
            Mobile Number <span className="text-brand">*</span>
          </label>
          <input
            type="tel"
            required
            maxLength={20}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="input-field"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">
            Product Details <span className="text-brand">*</span>
          </label>
          <textarea
            required
            rows={5}
            maxLength={5000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe the product — edition, region, denomination, links, anything that helps us find it."
            className="input-field min-h-[120px] resize-y"
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Submitting…" : "Submit Request"}
      </button>
    </form>
  );
}
