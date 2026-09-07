"use client";

import { useState } from "react";
import { submitContactForm } from "@/lib/api";
import { CONTACT_EMAIL_CARD_CLASS } from "@/components/contact/contact-email-card";

type ContactEmailFormProps = {
  className?: string;
  id?: string;
  heading?: string;
  description?: string;
  headingId?: string;
};

function SendIcon({ className }: { className?: string }) {
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
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function ContactEmailForm({
  className = "",
  id,
  heading = "Send Us An Email",
  description = "Prefer Email? Fill Out The Form Below And Our Team Will Get Back To You.",
  headingId,
}: ContactEmailFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitContactForm({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setSent(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send your message. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div
        className={`rounded-2xl border border-brand/25 bg-brand/8 px-6 py-8 text-center shadow-card ${className}`}
      >
        <p className="text-lg font-semibold text-foreground">
          Message sent successfully
        </p>
        <p className="mt-2 text-sm text-foreground-muted">
          Thank you for contacting us. Our support team will reply to your email
          soon.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="btn-secondary mt-6"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div
      id={id}
      className={`${CONTACT_EMAIL_CARD_CLASS} ${className}`}
    >
      <h2
        id={headingId}
        className="text-xl font-bold tracking-tight text-foreground"
      >
        {heading}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
        {description}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="contact-name"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle"
            >
              Your name
            </label>
            <input
              id="contact-name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input w-full text-sm"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label
              htmlFor="contact-email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle"
            >
              Email address
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="admin-input w-full text-sm"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="contact-subject"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle"
          >
            Subject
          </label>
          <input
            id="contact-subject"
            type="text"
            required
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="admin-input w-full text-sm"
            placeholder="How can we help?"
          />
        </div>

        <div>
          <label
            htmlFor="contact-message"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle"
          >
            Message
          </label>
          <textarea
            id="contact-message"
            required
            rows={5}
            maxLength={5000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="admin-input min-h-[8rem] w-full resize-y text-sm"
            placeholder="Write your message here…"
          />
        </div>

        {error ? (
          <p className="text-sm text-rose-400" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? (
            "Sending…"
          ) : (
            <>
              <SendIcon className="h-4 w-4 shrink-0" />
              Send Message
            </>
          )}
        </button>
      </form>
    </div>
  );
}
