"use client";

import { useState } from "react";
import {
  EyeIcon,
  MailIcon,
  TrashIcon,
} from "@/components/admin/icons";
import { AdminEmailLogPreviewModal } from "@/components/admin/AdminEmailLogPreviewModal";
import {
  adminPreviewNotificationDeliveryEmail,
  type NotificationDelivery,
} from "@/lib/api";

type CardTone = "success" | "amber" | "processing" | "muted";

const STATUS_META: Record<
  string,
  { label: string; tone: CardTone; badgeTone: "success" | "amber" | "processing" | "muted" }
> = {
  sent: { label: "Sent", tone: "success", badgeTone: "success" },
  failed: { label: "Failed", tone: "amber", badgeTone: "amber" },
  skipped: { label: "Skipped", tone: "muted", badgeTone: "muted" },
  pending: { label: "Pending", tone: "processing", badgeTone: "processing" },
};

function formatLogTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventLabel(event: string) {
  return event.replace(/\./g, " · ");
}

type Props = {
  row: NotificationDelivery;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  disabled?: boolean;
  deleting?: boolean;
};

export function AdminEmailLogCard({
  row,
  selected,
  onToggleSelect,
  onDelete,
  disabled = false,
  deleting = false,
}: Props) {
  const meta = STATUS_META[row.status] ?? {
    label: row.status,
    tone: "muted" as const,
    badgeTone: "muted" as const,
  };
  const subject = row.title?.trim() || formatEventLabel(row.event);
  const orderLabel = row.orderNumber ? `#${row.orderNumber}` : null;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | undefined>();
  const [previewRecipient, setPreviewRecipient] = useState<string | undefined>();
  const [previewHtml, setPreviewHtml] = useState<string | undefined>();
  const [previewNote, setPreviewNote] = useState<string | undefined>();

  async function openPreview() {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewHtml(undefined);
    setPreviewSubject(undefined);
    setPreviewRecipient(undefined);
    setPreviewNote(undefined);

    try {
      const result = await adminPreviewNotificationDeliveryEmail(row._id);
      if (!result.available || !result.html) {
        setPreviewError(
          result.note || "Email preview is not available for this log entry.",
        );
        setPreviewSubject(result.subject || row.title);
        setPreviewRecipient(result.recipient || row.recipient);
        return;
      }
      setPreviewSubject(result.subject || row.title);
      setPreviewRecipient(result.recipient || row.recipient);
      setPreviewHtml(result.html);
      setPreviewNote(result.note);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Could not load email preview",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <>
    <article
      className={`dashboard-recent-order dashboard-recent-order--${meta.tone}`}
    >
      <span className="dashboard-recent-order-accent" aria-hidden />

      <div className="dashboard-recent-order-inner">
        <div className="dashboard-recent-order-main">
          <span className="dashboard-recent-order-icon" aria-hidden>
            <MailIcon className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="dashboard-recent-order-header">
              <div className="dashboard-recent-order-title-block min-w-0">
                <p className="dashboard-recent-order-title truncate">
                  {subject}
                </p>
                <p className="dashboard-recent-order-meta">
                  {formatLogTime(row.createdAt)}
                  {row.recipient ? ` · ${row.recipient}` : ""}
                  {orderLabel ? ` · ${orderLabel}` : ""}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-subtle">
                  {formatEventLabel(row.event)}
                </p>
                {row.error ? (
                  <p className="mt-1 truncate text-xs text-rose-300">
                    {row.error}
                  </p>
                ) : null}
              </div>
              <span
                className={`dashboard-recent-order-badge dashboard-recent-order-badge--${meta.badgeTone}`}
              >
                {meta.label}
              </span>
            </div>
          </div>
        </div>

        <div className="dashboard-recent-order-actions">
          <label
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong/50 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-subtle"
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              disabled={disabled || deleting}
              aria-label={`Select email log ${row.orderNumber ?? row._id}`}
            />
            Select
          </label>
          <button
            type="button"
            onClick={() => void openPreview()}
            disabled={disabled || deleting}
            className="dashboard-recent-order-view disabled:opacity-40"
            aria-label={`View sent email ${row.orderNumber ?? row._id}`}
          >
            <EyeIcon className="h-4 w-4" aria-hidden />
            <span className="dashboard-recent-order-view-label">View email</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled || deleting}
            className="dashboard-recent-order-view text-rose-300 hover:text-rose-200 disabled:opacity-40"
            aria-label={`Delete email log ${row.orderNumber ?? row._id}`}
          >
            {deleting ? (
              <span className="dashboard-recent-order-view-label">Deleting…</span>
            ) : (
              <TrashIcon className="h-4 w-4" aria-hidden />
            )}
            {!deleting ? (
              <span className="dashboard-recent-order-view-label">Delete</span>
            ) : null}
          </button>
        </div>
      </div>
    </article>

    <AdminEmailLogPreviewModal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      subject={previewSubject || subject}
      recipient={previewRecipient || row.recipient}
      html={previewHtml}
      note={previewNote}
      loading={previewLoading}
      error={previewError}
    />
    </>
  );
}
