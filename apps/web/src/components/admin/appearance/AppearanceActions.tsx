"use client";

import { useAppearanceSettings } from "@/components/admin/appearance/AppearanceProvider";

export function AppearanceActions() {
  const { busy, save, resetDefaults } = useAppearanceSettings();

  return (
    <section
      className="admin-appearance-actions-bar"
      aria-label="Save appearance"
    >
      <div className="admin-appearance-actions-copy min-w-0">
        <span className="admin-appearance-actions-title">Save appearance</span>
        <span className="admin-appearance-actions-subtitle">
          Apply logo and theme changes to the storefront and admin panel.
        </span>
      </div>

      <span className="admin-appearance-actions-publish">Publish</span>

      <div className="admin-appearance-actions-buttons">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="btn-primary btn-primary-sm disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save appearance"}
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          disabled={busy}
          className="dashboard-pro-btn-ghost px-4 py-2 text-sm disabled:opacity-50"
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}
