"use client";

import { adminToast } from "@/lib/admin-toast";
import { useCallback, useEffect, useState } from "react";
import { ChatIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  getAdminMfsSmsFormats,
  resetAdminMfsSmsFormats,
  testAdminMfsSmsFormat,
  updateAdminMfsSmsFormats,
  type MfsSmsProviderFormat,
} from "@/lib/api";

const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

const PROVIDER_META: Record<string, { label: string; color: string; dot: string }> = {
  bkash:  { label: "bKash",  color: "bg-[#E2136E]/10 text-[#E2136E] border-[#E2136E]/30",  dot: "bg-[#E2136E]" },
  nagad:  { label: "Nagad",  color: "bg-[#F6921E]/10 text-[#F6921E] border-[#F6921E]/30",  dot: "bg-[#F6921E]" },
  rocket: { label: "Rocket", color: "bg-[#8B2E89]/10 text-[#8B2E89] border-[#8B2E89]/30",  dot: "bg-[#8B2E89]" },
  upay:   { label: "Upay",   color: "bg-[#006A4E]/10 text-[#006A4E] border-[#006A4E]/30",  dot: "bg-[#006A4E]" },
};

function linesToText(values: string[]): string {
  return values.join("\n");
}
function textToLines(value: string): string[] {
  return value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export function AdminMfsSmsFormatsPanel() {
  const [providers, setProviders] = useState<MfsSmsProviderFormat[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>("bkash");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminMfsSmsFormats();
      setProviders(data.providers);
      const firstProvider = data.providers[0];
      if (firstProvider) {
        setActiveProvider((current) =>
          data.providers.some((row) => row.provider === current)
            ? current
            : firstProvider.provider,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const current = providers.find((row) => row.provider === activeProvider);

  function patchCurrent(patch: Partial<MfsSmsProviderFormat>) {
    if (!current) return;
    setProviders((rows) =>
      rows.map((row) =>
        row.provider === current.provider ? { ...row, ...patch } : row,
      ),
    );
    setTestResult(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const data = await updateAdminMfsSmsFormats(providers);
      setProviders(data.providers);
      adminToast("SMS formats saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      adminToast(message, false);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset all SMS formats to defaults?")) return;
    setSaving(true);
    setError(null);
    try {
      const data = await resetAdminMfsSmsFormats();
      setProviders(data.providers);
      adminToast("SMS formats reset to defaults");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reset failed";
      setError(message);
      adminToast(message, false);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!current?.sampleSms.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAdminMfsSmsFormat({
        sms: current.sampleSms,
        sender: current.provider,
      });
      const meta = PROVIDER_META[result.provider];
      const amount = result.amount !== undefined ? `৳${result.amount}` : "—";
      const trx = result.trxId ?? "—";
      setTestResult({
        ok: result.allowed,
        text: `Provider: ${meta?.label ?? result.provider}  ·  TrxID: ${trx}  ·  Amount: ${amount}${result.allowed ? "" : "  ·  ⚠ NOT allowed"}`,
      });
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <ProductFormOrderCard
        icon={<ChatIcon className="h-4 w-4" />}
        title="SMS format rules"
        subtitle="Loading…"
        className="admin-product-form-section h-full"
        flatBody
      >
        <div className="flex items-center gap-3 py-2 text-sm text-subtle">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-[rgb(var(--brand))]" />
          Loading parser settings…
        </div>
      </ProductFormOrderCard>
    );
  }

  return (
    <ProductFormOrderCard
      icon={<ChatIcon className="h-4 w-4" />}
      title="SMS format rules"
      subtitle="Configure how payment SMS from bKash, Nagad, Rocket and Upay are parsed"
      className="admin-product-form-section h-full"
      flatBody
    >
      <div className="space-y-5">

        {/* Error banner */}
        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger">
            <span className="mt-0.5 font-bold">✕</span>
            <p>{error}</p>
          </div>
        ) : null}

        {/* Provider tabs */}
        <div className="flex flex-wrap gap-2">
          {providers.map((row) => {
            const meta = PROVIDER_META[row.provider];
            const isActive = activeProvider === row.provider;
            return (
              <button
                key={row.provider}
                type="button"
                onClick={() => { setActiveProvider(row.provider); setTestResult(null); }}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? (meta?.color ?? "bg-accent/10 text-accent border-accent/30")
                    : "border-border bg-sunken/30 text-foreground-muted hover:border-border-strong hover:text-foreground"
                }`}
              >
                {meta && (
                  <span className={`h-2 w-2 rounded-full ${meta.dot} ${isActive ? "opacity-100" : "opacity-40"}`} />
                )}
                {meta?.label ?? row.provider}
                {!row.enabled && (
                  <span className="ml-0.5 rounded bg-warning/20 px-1 py-px text-[9px] font-bold uppercase text-warning">off</span>
                )}
              </button>
            );
          })}
        </div>

        {current ? (
          <>
            {/* Sample SMS */}
            <div className="space-y-1.5">
              <label className={labelCls}>Sample SMS — used for testing</label>
              <textarea
                className="admin-input min-h-[130px] w-full font-mono text-xs leading-relaxed"
                value={current.sampleSms}
                onChange={(e) => patchCurrent({ sampleSms: e.target.value })}
                placeholder={"Paste a real SMS from this provider here…"}
              />
            </div>

            {/* Test result */}
            {testResult ? (
              <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
                testResult.ok
                  ? "border-success/30 bg-success/8 text-success"
                  : "border-danger/30 bg-danger/8 text-danger"
              }`}>
                <span className="mt-px font-bold">{testResult.ok ? "✓" : "✕"}</span>
                <span className="font-mono">{testResult.text}</span>
              </div>
            ) : null}

            {/* Advanced accordion */}
            <div className="overflow-hidden rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold text-foreground-muted hover:bg-sunken/40 hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-subtle">⚙</span>
                  Advanced pattern settings
                </span>
                <span className={`text-subtle transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}>▼</span>
              </button>

              {showAdvanced && (
                <div className="space-y-4 border-t border-border/60 bg-sunken/20 px-4 py-4">

                  {/* Priority + Enabled */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Priority (lower = checked first)</label>
                      <input
                        type="number"
                        className="admin-input w-full"
                        value={current.priority}
                        onChange={(e) => patchCurrent({ priority: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground-muted">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={current.enabled}
                          onChange={(e) => patchCurrent({ enabled: e.target.checked })}
                        />
                        Enabled for auto-verification
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Detect keywords — one per line</label>
                      <textarea
                        className="admin-input min-h-[80px] w-full font-mono text-xs"
                        value={linesToText(current.detectKeywords)}
                        onChange={(e) => patchCurrent({ detectKeywords: textToLines(e.target.value) })}
                        placeholder="money received"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Detect regex patterns — one per line</label>
                      <textarea
                        className="admin-input min-h-[80px] w-full font-mono text-xs"
                        value={linesToText(current.detectPatterns)}
                        onChange={(e) => patchCurrent({ detectPatterns: textToLines(e.target.value) })}
                        placeholder="txn\\s*id\\s*[:]"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>TrxID / TxnID patterns — capture group 1</label>
                      <textarea
                        className="admin-input min-h-[96px] w-full font-mono text-xs"
                        value={linesToText(current.trxIdPatterns)}
                        onChange={(e) => patchCurrent({ trxIdPatterns: textToLines(e.target.value) })}
                        placeholder="TxnID\s*[:]?\s*([A-Za-z0-9]+)"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Amount patterns — capture group 1</label>
                      <textarea
                        className="admin-input min-h-[96px] w-full font-mono text-xs"
                        value={linesToText(current.amountPatterns)}
                        onChange={(e) => patchCurrent({ amountPatterns: textToLines(e.target.value) })}
                        placeholder="Amount:\s*Tk\s*([\d,.]+)"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action row */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className="btn-primary disabled:opacity-50"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving…
                  </span>
                ) : "Save SMS formats"}
              </button>

              <button
                type="button"
                className="dashboard-pro-btn-ghost"
                disabled={testing || !current.sampleSms.trim()}
                onClick={() => void handleTest()}
              >
                {testing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-foreground-muted" />
                    Testing…
                  </span>
                ) : "▶ Test sample SMS"}
              </button>

              <button
                type="button"
                className="dashboard-pro-btn-ghost ml-auto text-xs text-rose-400 hover:text-rose-300"
                disabled={saving}
                onClick={() => void handleReset()}
              >
                ↺ Reset all to defaults
              </button>
            </div>
          </>
        ) : null}
      </div>
    </ProductFormOrderCard>
  );
}
