"use client";

import { useMemo } from "react";
import {
  computeProductSeoScore,
  type ProductSeoScoreInput,
  type ProductSeoCheck,
  type ProductSeoScoreTone,
} from "@/lib/product-seo-score";

const TONE_STYLES: Record<
  ProductSeoScoreTone,
  { score: string; bar: string; badge: string }
> = {
  excellent: {
    score: "text-emerald-300",
    bar: "bg-emerald-400",
    badge: "dashboard-pro-status dashboard-pro-status--green",
  },
  good: {
    score: "text-teal-300",
    bar: "bg-teal-400",
    badge: "dashboard-pro-status dashboard-pro-status--green",
  },
  "needs-improvement": {
    score: "text-amber-300",
    bar: "bg-amber-400",
    badge: "dashboard-pro-status dashboard-pro-status--amber",
  },
  poor: {
    score: "text-rose-300",
    bar: "bg-rose-400",
    badge: "dashboard-pro-status dashboard-pro-status--amber",
  },
};

function CheckRow({ check }: { check: ProductSeoCheck }) {
  const icon =
    check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✕";
  const iconClass =
    check.status === "pass"
      ? "text-emerald-300"
      : check.status === "warn"
        ? "text-amber-300"
        : "text-rose-300";

  return (
    <li className="space-y-0.5">
      <div className="flex items-start gap-2 text-sm">
        <span className={`mt-0.5 shrink-0 font-semibold ${iconClass}`}>
          {icon}
        </span>
        <span
          className={
            check.status === "pass"
              ? "text-foreground"
              : "text-foreground-muted"
          }
        >
          {check.label}
        </span>
      </div>
      {check.detail ? (
        <p className="pl-5 text-[11px] leading-relaxed text-subtle">
          {check.detail}
        </p>
      ) : null}
    </li>
  );
}

export function AdminProductSeoScorePanel({
  input,
}: {
  input: ProductSeoScoreInput;
}) {
  const result = useMemo(() => computeProductSeoScore(input), [input]);
  const styles = TONE_STYLES[result.tone];

  const primaryChecks = result.checks.filter((check) =>
    [
      "title",
      "meta-title",
      "meta-description",
      "description",
      "image-alt",
      "category",
    ].includes(check.id),
  );

  return (
    <div className="admin-product-seo-score space-y-4 rounded-xl border border-border/50 bg-muted/15 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
            SEO Score
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className={`text-2xl font-bold ${styles.score}`}>
              {result.score}
            </span>
            <span className="text-sm text-subtle">/100</span>
            <span className={styles.badge}>{result.statusLabel}</span>
          </div>
        </div>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-muted/50"
        role="progressbar"
        aria-valuenow={result.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Product SEO score"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${styles.bar}`}
          style={{ width: `${result.score}%` }}
        />
      </div>

      <ul className="space-y-2.5">
        {primaryChecks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </ul>

      {result.warnings.length > 0 ? (
        <div className="space-y-1.5 border-t border-border/40 pt-3">
          {result.warnings.slice(0, 4).map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 text-xs text-amber-200/90"
            >
              <span className="shrink-0 font-semibold text-amber-300">⚠</span>
              <span>{warning}</span>
            </p>
          ))}
        </div>
      ) : null}

      <p className="text-[10px] leading-relaxed text-subtle">
        Assistant only — improves on-page SEO fields. Does not guarantee search
        rankings.
      </p>
    </div>
  );
}
