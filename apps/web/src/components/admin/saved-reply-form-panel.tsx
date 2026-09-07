"use client";

import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { MailIcon } from "@/components/admin/icons";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

export type SavedReplyFormValues = {
  label: string;
  category: string;
  body: string;
  enabled: boolean;
};

type SavedReplyFormPanelProps = {
  mode: "create" | "edit";
  form: SavedReplyFormValues;
  saving: boolean;
  error: string | null;
  onChange: (patch: Partial<SavedReplyFormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelEdit?: () => void;
};

export function SavedReplyFormPanel({
  mode,
  form,
  saving,
  error,
  onChange,
  onSubmit,
  onCancelEdit,
}: SavedReplyFormPanelProps) {
  const isEdit = mode === "edit";

  return (
    <form onSubmit={onSubmit}>
      <ProductFormOrderCard
        className="admin-product-form-section admin-saved-replies-form"
        icon={<MailIcon className="h-4 w-4" />}
        title={isEdit ? "Edit reply" : "New reply"}
        subtitle={
          isEdit
            ? "Update the selected saved reply template."
            : "Create a reusable message for live chat staff."
        }
      >
        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        ) : null}

        <div className="admin-product-form-sidebar-fields space-y-4">
          <div>
            <label htmlFor="saved-reply-label" className={labelCls}>
              Label
            </label>
            <input
              id="saved-reply-label"
              required
              maxLength={120}
              value={form.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Greeting"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="saved-reply-category" className={labelCls}>
              Category
            </label>
            <input
              id="saved-reply-category"
              maxLength={60}
              value={form.category}
              onChange={(e) => onChange({ category: e.target.value })}
              placeholder="General, Billing, Delivery…"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="saved-reply-body" className={labelCls}>
              Message
            </label>
            <textarea
              id="saved-reply-body"
              required
              rows={6}
              maxLength={4000}
              value={form.body}
              onChange={(e) => onChange({ body: e.target.value })}
              placeholder="Welcome to UniQbd support! How can we help you today?"
              className={`${inputCls} min-h-[8rem] resize-y`}
            />
            <p className="mt-1 text-[10px] text-subtle">
              {form.body.length.toLocaleString()} / 4,000 characters
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground-muted">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              className="rounded border-border-strong"
            />
            Enabled for staff use
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary btn-primary-sm px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create reply"}
            </button>
            {isEdit && onCancelEdit ? (
              <button
                type="button"
                disabled={saving}
                onClick={onCancelEdit}
                className="dashboard-pro-btn-ghost px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>
      </ProductFormOrderCard>
    </form>
  );
}
