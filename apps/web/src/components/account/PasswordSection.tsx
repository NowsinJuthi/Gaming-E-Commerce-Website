"use client";

import { useState } from "react";
import { changePassword } from "@/lib/api";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from "@/lib/password-rules";
import {
  accountPanelClass,
  accountSectionStackClass,
  type AccountSectionProps,
} from "@/components/account/account-section-layout";

export function PasswordSection({ embedded = false }: AccountSectionProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (newPassword !== confirmPassword) {
      setMsg({ type: "err", text: "New passwords do not match." });
      return;
    }

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg({
        type: "ok",
        text: "Password updated successfully. You will receive a confirmation notification.",
      });
    } catch (err) {
      setMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Could not change password",
      });
    } finally {
      setBusy(false);
    }
  }

  const formClass = embedded
    ? "customer-profile-form-panel customer-profile-form-grid grid w-full gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3"
    : "shell-panel grid w-full gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={accountSectionStackClass(embedded)}>
      <div className={accountPanelClass(embedded)}>
        <p className="text-sm text-foreground-muted">
          {PASSWORD_HINT}
        </p>
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

      <form onSubmit={onSubmit} className={formClass}>
        <div>
          <label className="admin-filter-label">Current password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="admin-input mt-1 w-full"
          />
        </div>
        <div>
          <label className="admin-filter-label">New password</label>
          <input
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="admin-input mt-1 w-full"
          />
        </div>
        <div>
          <label className="admin-filter-label">Confirm new password</label>
          <input
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="admin-input mt-1 w-full"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full sm:w-auto disabled:opacity-50"
          >
            {busy ? "Updating…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}
