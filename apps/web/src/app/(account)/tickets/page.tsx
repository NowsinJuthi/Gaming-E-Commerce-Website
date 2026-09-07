"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import {
  CONTACT_EMAIL_CARD_CLASS,
  CONTACT_EMAIL_CARD_SURFACE_CLASS,
} from "@/components/contact/contact-email-card";
import {
  createTicket,
  listTickets,
  type Ticket,
  type TicketPriority,
} from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  in_progress: "bg-muted text-foreground-muted ring-1 ring-border",
  pending: "bg-muted text-foreground-muted ring-1 ring-border",
  resolved: "bg-brand/15 text-brand ring-1 ring-brand/35",
  closed: "bg-muted text-foreground-muted ring-1 ring-border",
};

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTickets({ limit: 50 })
      .then((r) => {
        if (!cancelled) setTickets(r.items);
      })
      .catch(() => {
        if (!cancelled) {
          setTickets([]);
          setLoadError("Could not load tickets.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const t = await createTicket({
        subject,
        body,
        category: category || undefined,
        priority,
      });
      setShowForm(false);
      setSubject("");
      setBody("");
      setCategory("");
      router.push(`/tickets/${t._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CustomerPageLayout
      section=""
      iconKey="support"
      title="Support tickets"
      description="Create and track support requests"
      backHref="/support"
      backLabel="Support"
      heroSurfaceClassName={CONTACT_EMAIL_CARD_SURFACE_CLASS}
      loading={loading && !showForm}
      loadingText="Loading tickets…"
      action={
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="dashboard-pro-btn-ghost"
        >
          {showForm ? "Cancel" : "New ticket"}
        </button>
      }
    >
      {showForm ? (
        <form
          onSubmit={onCreate}
          className={`${CONTACT_EMAIL_CARD_CLASS} space-y-4`}
        >
          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="ticket-subject" className="admin-filter-label">
              Subject *
            </label>
            <input
              id="ticket-subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="admin-input mt-1 w-full"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ticket-category" className="admin-filter-label">
                Category
              </label>
              <input
                id="ticket-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Billing, Order, Account…"
                className="admin-input mt-1 w-full"
              />
            </div>
            <div>
              <label htmlFor="ticket-priority" className="admin-filter-label">
                Priority
              </label>
              <select
                id="ticket-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="admin-select mt-1 w-full"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="ticket-body" className="admin-filter-label">
              Message *
            </label>
            <textarea
              id="ticket-body"
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="admin-input mt-1 min-h-[120px] w-full resize-y"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Creating…" : "Submit ticket"}
          </button>
        </form>
      ) : null}

      {loadError ? (
        <div
          className={`${CONTACT_EMAIL_CARD_CLASS} border border-rose-500/30 bg-rose-500/10 text-center text-sm text-rose-300`}
        >
          {loadError}
        </div>
      ) : tickets.length === 0 ? (
        <div
          className={`${CONTACT_EMAIL_CARD_CLASS} border-dashed text-center text-sm text-foreground-muted`}
        >
          No tickets yet.
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link
              key={t._id}
              href={`/tickets/${t._id}`}
              className="admin-input flex cursor-pointer items-center justify-between gap-3 p-4 transition hover:border-brand/40"
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{t.subject}</p>
                <p className="text-sm text-foreground-muted">
                  {t.ticketNumber}
                  {t.category ? ` · ${t.category}` : ""}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_BADGE[t.status] ?? STATUS_BADGE.pending}`}
              >
                {t.status.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </CustomerPageLayout>
  );
}
