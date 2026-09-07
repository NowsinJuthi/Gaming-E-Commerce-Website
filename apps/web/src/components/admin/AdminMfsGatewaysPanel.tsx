"use client";

import { adminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import {
  CheckIcon,
  CreditCardIcon,
  DollarIcon,
  PulseIcon,
  WalletIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  approveAdminMfsIntent,
  createAdminMfsGateway,
  deleteAdminMfsGateway,
  listAdminMfsGateways,
  listAdminMfsIntents,
  updateAdminMfsGateway,
  uploadMfsQrCode,
  type MfsGateway,
  type MfsGatewayInput,
  type MfsProviderId,
} from "@/lib/api";
import { resolveMediaSrc } from "@/lib/site-appearance";
import { AdminMfsSmsFormatsPanel } from "@/components/admin/AdminMfsSmsFormatsPanel";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";
const QR_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";

const PROVIDERS: { value: MfsProviderId; label: string }[] = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "upay", label: "Upay" },
];

type Form = MfsGatewayInput & { id?: string };

const EMPTY: Form = {
  name: "",
  provider: "bkash",
  phoneNumber: "",
  qrCodeUrl: "",
  minAmount: 10,
  maxAmount: 100000,
  isActive: true,
  sortOrder: 0,
  instructions: "",
};

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type MfsStatTone = "brand" | "success" | "amber" | "muted";

type MfsOverviewStat = {
  key: string;
  tone: MfsStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function MfsOverviewStats({ items }: { items: MfsOverviewStat[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-mfs-overview"
      aria-label="MFS gateway overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-mfs-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-mfs-overview-stat-icon admin-mfs-overview-stat-icon--${item.tone}`}
              aria-hidden
            >
              {item.icon}
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">
                {item.label}
              </dt>
              <dd className="customer-dashboard-overview-stat-value">
                {item.value}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                {item.meta}
              </p>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function AdminMfsGatewaysPanel() {
  const [gateways, setGateways] = useState<MfsGateway[]>([]);
  const [pending, setPending] = useState<
    Array<{
      _id: string;
      amount: number;
      currency: string;
      status: string;
      submittedTrxId?: string;
      createdAt?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qrUploadError, setQrUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gw, intents] = await Promise.all([
        listAdminMfsGateways(),
        listAdminMfsIntents("pending"),
      ]);
      setGateways(gw);
      setPending(intents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let active = 0;
    for (const g of gateways) if (g.isActive) active += 1;
    return { total: gateways.length, active, pending: pending.length };
  }, [gateways, pending]);

  const mfsOverviewStats = useMemo<MfsOverviewStat[]>(
    () => [
      {
        key: "gateways",
        tone: "brand",
        icon: <CreditCardIcon className="h-4 w-4" />,
        label: "Gateways",
        value: loadingStat(loading, stats.total.toLocaleString()),
        meta: "Configured MFS numbers",
      },
      {
        key: "active",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Active",
        value: loadingStat(loading, stats.active.toLocaleString()),
        meta: "Live on storefront",
      },
      {
        key: "pending",
        tone: "amber",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Pending payments",
        value: loadingStat(loading, stats.pending.toLocaleString()),
        meta: "Awaiting manual approval",
      },
    ],
    [loading, stats.active, stats.pending, stats.total],
  );

  function startEdit(gw: MfsGateway) {
    setEditingId(gw.id);
    setForm({
      id: gw.id,
      name: gw.name,
      provider: gw.provider,
      phoneNumber: gw.phoneNumber,
      qrCodeUrl: gw.qrCodeUrl ?? "",
      minAmount: gw.minAmount,
      maxAmount: gw.maxAmount,
      isActive: gw.isActive,
      sortOrder: gw.sortOrder,
      instructions: gw.instructions ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: MfsGatewayInput = {
        name: form.name.trim(),
        provider: form.provider,
        phoneNumber: form.phoneNumber.trim(),
        qrCodeUrl: form.qrCodeUrl?.trim() || undefined,
        minAmount: form.minAmount,
        maxAmount: form.maxAmount,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
        instructions: form.instructions?.trim() || undefined,
      };
      if (editingId) {
        await updateAdminMfsGateway(editingId, payload);
      } else {
        await createAdminMfsGateway(payload);
      }
      adminToast(editingId ? "Gateway updated" : "Gateway created", true);
      resetForm();
      await load();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this MFS gateway?")) return;
    try {
      await deleteAdminMfsGateway(id);
      adminToast("Gateway deleted", true);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Delete failed", false);
    }
  }

  async function handleQrUpload(file: File) {
    setUploading(true);
    setQrUploadError(null);
    try {
      const { url } = await uploadMfsQrCode(file);
      setForm((f) => ({ ...f, qrCodeUrl: url }));
      adminToast("QR uploaded", true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setQrUploadError(message);
      adminToast(message, false);
    } finally {
      setUploading(false);
      if (qrFileRef.current) qrFileRef.current.value = "";
    }
  }

  async function handleApprove(intentId: string) {
    try {
      await approveAdminMfsIntent(intentId);
      adminToast("Payment approved", true);
      await load();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Approve failed", false);
    }
  }

  return (
    <div id="mfs-gateways" className="space-y-6 scroll-mt-24">
      <p className="text-sm text-foreground-muted">
        MFS SMS verification uses the SMS listener app and format rules below —
        not SMTP email or live chat. Customer order emails are under{" "}
        <Link href="/admin/settings/email" className="text-accent hover:underline">
          Settings → Email / SMTP
        </Link>
        .
      </p>
      <AdminOrderListCard
        icon={<WalletIcon className="h-4 w-4" />}
        title="MFS gateway overview"
        subtitle="Send-money numbers and TrxID checkout"
        className="admin-payments-mfs-overview"
      >
        <MfsOverviewStats items={mfsOverviewStats} />
        <p className="mt-4 border-t border-border/40 pt-4 text-xs text-foreground-muted">
          SMS auto-match logs:{" "}
          <Link href="/admin/sales/sms-logs" className="text-accent hover:underline">
            SMS logs
          </Link>
        </p>
      </AdminOrderListCard>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="admin-mfs-forms-grid">
        <AdminMfsSmsFormatsPanel />

        <form onSubmit={handleSave} className="h-full min-w-0">
          <ProductFormOrderCard
            icon={<DollarIcon className="h-4 w-4" />}
            title={editingId ? "Edit MFS gateway" : "Add MFS gateway"}
            subtitle="Merchant number, QR code, and amount limits"
            className="admin-product-form-section h-full space-y-4"
            flatBody
          >
          <div>
            <label className={labelCls}>Display name</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="bKash Personal"
              required
            />
          </div>

          <div>
            <label className={labelCls}>Provider</label>
            <AdminSelect
              value={form.provider}
              onChange={(v) => setForm({ ...form, provider: v as MfsProviderId })}
              options={PROVIDERS}
            />
          </div>

          <div>
            <label className={labelCls}>Merchant number</label>
            <input
              className={inputCls}
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              placeholder="01XXXXXXXXX"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div>
              <label className={labelCls}>Min amount (BDT)</label>
              <input
                type="number"
                className={inputCls}
                value={form.minAmount ?? 10}
                onChange={(e) =>
                  setForm({ ...form, minAmount: Number(e.target.value) })
                }
                min={1}
              />
            </div>
            <div>
              <label className={labelCls}>Max amount (BDT)</label>
              <input
                type="number"
                className={inputCls}
                value={form.maxAmount ?? 100000}
                onChange={(e) =>
                  setForm({ ...form, maxAmount: Number(e.target.value) })
                }
                min={1}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>QR code (optional)</label>
            <input
              ref={qrFileRef}
              type="file"
              accept={QR_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleQrUpload(file);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => qrFileRef.current?.click()}
                className="dashboard-pro-btn-ghost disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Upload QR image"}
              </button>
              {form.qrCodeUrl ? (
                <button
                  type="button"
                  className="dashboard-pro-btn-ghost text-xs text-rose-400"
                  onClick={() => {
                    setForm((f) => ({ ...f, qrCodeUrl: "" }));
                    setQrUploadError(null);
                    if (qrFileRef.current) qrFileRef.current.value = "";
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-subtle">
              JPG, PNG, WebP, or GIF — max 2 MB
            </p>
            {qrUploadError ? (
              <p className="mt-2 text-xs text-rose-400">{qrUploadError}</p>
            ) : null}
            {form.qrCodeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveMediaSrc(form.qrCodeUrl)}
                alt="QR preview"
                className="mt-3 max-h-40 rounded-xl border border-border/60 bg-white p-2"
              />
            ) : null}
          </div>

          <div>
            <label className={labelCls}>Custom instructions (optional)</label>
            <textarea
              className="admin-input w-full min-h-[80px]"
              value={form.instructions ?? ""}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Leave blank to use default provider instructions"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive ?? true}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active on storefront
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="dashboard-pro-btn-ghost"
                onClick={resetForm}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </ProductFormOrderCard>
        </form>
      </div>

      <AdminOrderListCard
        icon={<DollarIcon className="h-4 w-4" />}
        title="Configured MFS gateways"
        subtitle="bKash, Nagad, Rocket, and Upay send-money numbers"
      >
        {loading ? (
          <p className="text-sm text-subtle">Loading…</p>
        ) : gateways.length === 0 ? (
          <p className="text-sm text-subtle">
            No gateways yet. Add your first bKash or Nagad number above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="dashboard-pro-table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Number</th>
                  <th>Amount range</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {gateways.map((gw) => (
                  <tr key={gw.id}>
                    <td className="font-medium">{gw.name}</td>
                    <td>{gw.providerLabel}</td>
                    <td className="font-mono text-xs">{gw.phoneNumber}</td>
                    <td className="text-xs text-subtle">
                      ৳{gw.minAmount} – ৳{gw.maxAmount}
                    </td>
                    <td>
                      <span
                        className={`dashboard-pro-status ${
                          gw.isActive ? "dashboard-pro-status--green" : ""
                        }`}
                      >
                        {gw.isActive ? "Active" : "Off"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="dashboard-pro-btn-ghost text-xs"
                        onClick={() => startEdit(gw)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="dashboard-pro-btn-ghost text-xs text-rose-400"
                        onClick={() => void handleDelete(gw.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pending.length > 0 ? (
          <>
            <h3 className="mt-8 mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <PulseIcon className="h-4 w-4 text-amber-400" aria-hidden />
              Pending verifications
            </h3>
            <ul className="space-y-2">
              {pending.map((row) => (
                <li
                  key={row._id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-sunken/40 px-3 py-2 text-sm"
                >
                  <span>
                    ৳{row.amount}{" "}
                    {row.submittedTrxId
                      ? `· TrxID ${row.submittedTrxId}`
                      : "· awaiting TrxID"}
                  </span>
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost text-xs"
                    onClick={() => void handleApprove(row._id)}
                  >
                    Approve manually
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </AdminOrderListCard>
    </div>
  );
}
