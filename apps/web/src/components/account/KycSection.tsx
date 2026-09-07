"use client";

import { useEffect, useState } from "react";
import { ShieldIcon } from "@/components/admin/icons";
import {
  getKyc,
  submitKyc,
  type KycDocType,
  type KycOverview,
} from "@/lib/api";
import {
  accountPanelClass,
  accountSectionStackClass,
  type AccountSectionProps,
} from "@/components/account/account-section-layout";

const DOC_TYPES: Array<{ value: KycDocType; label: string }> = [
  { value: "national_id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "driver_license", label: "Driver's license" },
];

const DEFAULT_STATUS_META = {
  label: "Not submitted",
  badge: "bg-muted text-foreground-muted ring-1 ring-border",
  dot: "bg-subtle",
};

const STATUS_META: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  none: DEFAULT_STATUS_META,
  pending: {
    label: "Under review",
    badge: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    dot: "bg-amber-400",
  },
  verified: {
    label: "Verified",
    badge: "bg-brand/15 text-brand ring-1 ring-brand/35",
    dot: "bg-brand",
  },
  rejected: {
    label: "Rejected",
    badge: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
    dot: "bg-rose-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? DEFAULT_STATUS_META;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold capitalize ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function formatSubmittedDate(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : ` · ${date.toLocaleDateString()}`;
}

export function KycSection({ embedded = false }: AccountSectionProps) {
  const [data, setData] = useState<KycOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<KycDocType>("national_id");
  const [urls, setUrls] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    getKyc()
      .then((overview) => {
        if (!cancelled) setData(overview);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setMsg({
            type: "err",
            text: "Could not load verification status.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const fileUrls = urls
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (fileUrls.length === 0) {
      setMsg({ type: "err", text: "Add at least one document URL." });
      return;
    }
    if (fileUrls.length > 5) {
      setMsg({ type: "err", text: "You can submit up to 5 document URLs." });
      return;
    }
    setSaving(true);
    try {
      await submitKyc(docType, fileUrls);
      const overview = await getKyc();
      setData(overview);
      setMsg({ type: "ok", text: "KYC documents submitted for review." });
      setUrls("");
    } catch (err) {
      setMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Submission failed",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className={accountPanelClass(
          embedded,
          "flex items-center justify-center p-10",
        )}
      >
        <p className="text-sm text-foreground-muted">Loading verification…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={accountPanelClass(
          embedded,
          "border border-rose-500/30 bg-rose-500/10 p-10 text-center text-sm text-rose-300",
        )}
      >
        {msg?.text ?? "Could not load verification status."}
      </div>
    );
  }

  const status = data.status ?? "none";
  const panel = (extra?: string) => accountPanelClass(embedded, extra);

  return (
    <div className={accountSectionStackClass(embedded)}>
      <div
        className={panel("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between")}
      >
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
            <ShieldIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Identity verification
            </h2>
            <p className="mt-0.5 text-sm text-foreground-muted">
              Submit government ID to unlock higher limits and faster payouts.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-subtle">
            Status
          </span>
          <StatusBadge status={status} />
        </div>
      </div>

      {msg ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border border-brand/30 bg-brand/10 text-brand"
              : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      {status !== "verified" ? (
        <form onSubmit={onSubmit} className={panel("space-y-5")}>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Submit documents
            </h3>
            <p className="mt-1 text-sm text-foreground-muted">
              Choose your ID type and paste secure image links for review.
            </p>
          </div>

          <label className="block" htmlFor="kyc-doc-type">
            <span className="admin-filter-label">Document type</span>
            <select
              id="kyc-doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as KycDocType)}
              className="admin-select mt-1 w-full"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block" htmlFor="kyc-doc-urls">
            <span className="admin-filter-label">Document URLs</span>
            <div className="rounded-xl border border-dashed border-border bg-sunken/50 p-1 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/15">
              <textarea
                id="kyc-doc-urls"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={4}
                placeholder={
                  "https://example.com/id-front.jpg\nhttps://example.com/id-back.jpg"
                }
                className="min-h-[120px] w-full resize-y rounded-lg border-0 bg-transparent px-3 py-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-0"
              />
            </div>
            <p className="mt-2 text-xs text-subtle">
              One URL per line (or comma-separated), up to 5 files.
            </p>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      ) : (
        <div className={panel("border border-brand/25 bg-brand/5")}>
          <p className="text-sm font-medium text-brand">
            Your identity is verified. No further action is needed.
          </p>
        </div>
      )}

      <section className={panel()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Submitted documents
            </h3>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Track review status for each upload.
            </p>
          </div>
          {data.documents.length > 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground-muted">
              {data.documents.length} item{data.documents.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {data.documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-sunken/40 px-6 py-10 text-center">
            <p className="text-sm font-medium text-foreground-muted">
              No documents submitted yet
            </p>
            <p className="mt-1 text-xs text-subtle">
              Upload links above to start verification.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.documents.map((d) => (
              <li
                key={d._id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-elevated px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize text-foreground">
                    {d.documentType.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground-muted">
                    {d.fileUrls.length} file{d.fileUrls.length === 1 ? "" : "s"}
                    {formatSubmittedDate(d.createdAt)}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
