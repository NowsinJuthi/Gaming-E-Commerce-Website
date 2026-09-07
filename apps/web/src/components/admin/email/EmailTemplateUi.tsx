"use client";

import type { EmailTemplateItem } from "@/lib/api";
import {
  CartIcon,
  MailIcon,
  ShieldIcon,
  ZapIcon,
} from "@/components/admin/icons";

export const CATEGORY_META: Record<
  EmailTemplateItem["category"],
  {
    title: string;
    description: string;
    accent: string;
    icon: typeof MailIcon;
  }
> = {
  orders: {
    title: "Orders",
    description: "Lifecycle emails for purchases, delivery, refunds, and admin alerts.",
    accent: "from-teal-500/20 to-emerald-500/5 border-teal-500/25",
    icon: CartIcon,
  },
  account: {
    title: "Account",
    description: "Welcome, verification, and password recovery messages.",
    accent: "from-violet-500/20 to-indigo-500/5 border-violet-500/25",
    icon: ShieldIcon,
  },
  system: {
    title: "System",
    description: "Operational diagnostics and infrastructure notifications.",
    accent: "from-amber-500/15 to-orange-500/5 border-amber-500/25",
    icon: ZapIcon,
  },
};

export const CATEGORY_ORDER: EmailTemplateItem["category"][] = [
  "orders",
  "account",
  "system",
];

export function RecipientBadge({
  recipient,
}: {
  recipient: EmailTemplateItem["recipient"];
}) {
  const admin = recipient === "admin";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        admin
          ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20"
          : "bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/20"
      }`}
    >
      {recipient}
    </span>
  );
}

export function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        enabled
          ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
          : "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          enabled ? "bg-emerald-400" : "bg-amber-400"
        }`}
      />
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-white/[0.02] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-foreground-muted">{hint}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
          checked ? "bg-teal-500" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "default" | "emerald" | "amber" | "teal";
}) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "amber"
        ? "text-amber-400"
        : accent === "teal"
          ? "text-teal-300"
          : "text-foreground";

  return (
    <div className="shell-panel group relative overflow-hidden p-4 transition hover:border-teal-500/20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent opacity-0 transition group-hover:opacity-100" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${valueClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-foreground-muted">{hint}</p> : null}
    </div>
  );
}

export function CustomDesignBadge({ template }: { template: EmailTemplateItem }) {
  const custom = Boolean(template.heading.trim() || template.bodyText.trim());
  if (!custom) return null;
  return (
    <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300 ring-1 ring-sky-500/20">
      Custom design
    </span>
  );
}

export function CategorySectionHeader({
  category,
  count,
}: {
  category: EmailTemplateItem["category"];
  count: number;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <div
      className={`rounded-xl border bg-gradient-to-r p-4 ${meta.accent}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-teal-300">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {meta.title}
            </h3>
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-foreground-muted">
              {count} templates
            </span>
          </div>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {meta.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PlaceholderChip({
  value,
  onClick,
}: {
  value: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-md border border-border bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-teal-200/90 ${
        onClick
          ? "cursor-pointer transition hover:border-teal-500/30 hover:bg-teal-500/10"
          : ""
      }`}
    >
      {value}
    </Tag>
  );
}

export const EMAIL_PLACEHOLDERS = [
  "{{store_name}}",
  "{{order_number}}",
  "{{customer_name}}",
  "{{order_total}}",
  "{{order_id}}",
  "{{verification_code}}",
  "{{reset_url}}",
  "{{verify_url}}",
  "{{note_message}}",
  "{{failure_reason}}",
  "{{inquiry_subject}}",
  "{{reply_message}}",
  "{{product_name}}",
  "{{chat_message}}",
  "{{chat_url}}",
] as const;
