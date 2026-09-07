"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import {
  CONTACT_EMAIL_CARD_CLASS,
  CONTACT_EMAIL_CARD_SURFACE_CLASS,
} from "@/components/contact/contact-email-card";
import {
  getMe,
  getTicket,
  getTicketMessages,
  replyTicket,
  type Ticket,
  type TicketMessage,
} from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  in_progress: "bg-muted text-foreground-muted ring-1 ring-border",
  pending: "bg-muted text-foreground-muted ring-1 ring-border",
  resolved: "bg-brand/15 text-brand ring-1 ring-brand/35",
  closed: "bg-muted text-foreground-muted ring-1 ring-border",
};

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getMe().catch(() => null),
      getTicket(id),
      getTicketMessages(id, 1, 200),
    ])
      .then(([me, t, m]) => {
        if (cancelled) return;
        if (me) setMeId(me.id);
        setTicket(t);
        setMessages(m.items);
      })
      .catch(() => {
        if (!cancelled) setTicket(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await replyTicket(id, reply.trim());
      setReply("");
      const [t, m] = await Promise.all([
        getTicket(id),
        getTicketMessages(id, 1, 200),
      ]);
      setTicket(t);
      setMessages(m.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setSending(false);
    }
  }

  if (!loading && !ticket) {
    return (
      <CustomerPageLayout
        section=""
        iconKey="support"
        title="Ticket"
        backHref="/tickets"
        backLabel="My tickets"
        heroSurfaceClassName={CONTACT_EMAIL_CARD_SURFACE_CLASS}
      >
        <div
          className={`${CONTACT_EMAIL_CARD_CLASS} border-dashed text-center text-sm text-foreground-muted`}
        >
          Ticket not found.
        </div>
      </CustomerPageLayout>
    );
  }

  const settled =
    ticket?.status === "closed" || ticket?.status === "resolved";

  return (
    <CustomerPageLayout
      section=""
      iconKey="support"
      title={ticket?.subject ?? "Ticket"}
      description={
        ticket
          ? `${ticket.ticketNumber} · ${ticket.priority} priority`
          : undefined
      }
      backHref="/tickets"
      backLabel="My tickets"
      heroSurfaceClassName={CONTACT_EMAIL_CARD_SURFACE_CLASS}
      loading={loading || !ticket}
      loadingText="Loading ticket…"
    >
      {ticket ? (
        <div className={`${CONTACT_EMAIL_CARD_CLASS} w-full`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-foreground-muted capitalize">
              Status: {ticket.status.replaceAll("_", " ")}
              {ticket.category ? ` · ${ticket.category}` : ""}
            </p>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_BADGE[ticket.status] ?? STATUS_BADGE.pending}`}
            >
              {ticket.status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {messages.map((m) => {
              const mine = m.senderId === meId;
              return (
                <div
                  key={m._id}
                  className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm ${
                    mine
                      ? "ml-auto border-brand/30 bg-brand/10"
                      : "border-border bg-elevated"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold capitalize text-foreground-muted">
                    {m.senderRole}
                    {m.createdAt
                      ? ` · ${new Date(m.createdAt).toLocaleString()}`
                      : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-foreground">{m.body}</p>
                </div>
              );
            })}
          </div>

          {settled ? (
            <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 capitalize">
              This ticket is {ticket.status.replaceAll("_", " ")}. You can still
              reply to reopen it.
            </p>
          ) : null}

          <form onSubmit={onReply} className="mt-4 space-y-3">
            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            ) : null}
            <textarea
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply…"
              className="admin-input min-h-[100px] w-full resize-y"
            />
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send reply"}
            </button>
          </form>
        </div>
      ) : null}
    </CustomerPageLayout>
  );
}
