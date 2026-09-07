"use client";

import {
  useId,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PriceText } from "@/components/ui/PriceText";
import {
  type AdminOverview,
  type AdminReports,
} from "@/lib/api";

type Props = {
  data: AdminOverview;
  reports: AdminReports | null;
};

const CHART_H = 88;
const CHART_W = 200;

function lastN<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return items.slice(-n);
}

function maxVal(values: number[], floor = 1): number {
  return Math.max(...values, floor);
}

function monthLabel(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short" });
}

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function BarChart({
  values,
  labels,
  color = "rgb(var(--brand))",
}: {
  values: number[];
  labels: string[];
  color?: string;
}) {
  const peak = maxVal(values);
  const barW = CHART_W / Math.max(values.length, 1);

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="admin-analytics-chart-svg"
      aria-hidden
    >
      {values.map((v, i) => {
        const h = (v / peak) * (CHART_H - 18);
        const x = i * barW + barW * 0.18;
        const w = barW * 0.64;
        return (
          <g key={`${labels[i]}-${i}`}>
            <rect
              x={x}
              y={CHART_H - h - 14}
              width={w}
              height={h}
              rx={3}
              fill={color}
              fillOpacity={0.72}
              className="admin-analytics-bar"
            />
            <text
              x={x + w / 2}
              y={CHART_H - 2}
              textAnchor="middle"
              className="admin-analytics-axis-label"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AreaChart({
  values,
  color = "rgb(var(--success))",
}: {
  values: number[];
  color?: string;
}) {
  const gradientId = useId();
  const peak = maxVal(values);
  const step = CHART_W / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = CHART_H - 14 - (v / peak) * (CHART_H - 28);
    return `${x},${y}`;
  });

  const line = points.join(" ");
  const area = `${points[0]?.split(",")[0] ?? 0},${CHART_H - 14} ${line} ${CHART_W},${CHART_H - 14}`;

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="admin-analytics-chart-svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={area}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DONUT_COLORS = [
  "rgb(var(--brand))",
  "rgb(var(--accent))",
  "rgb(var(--success))",
  "rgb(244 63 94)",
  "rgb(251 191 36)",
];

function DonutChart({
  segments,
}: {
  segments: Array<{ label: string; value: number }>;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 34;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="admin-analytics-donut-wrap">
      <svg viewBox="0 0 100 100" className="admin-analytics-donut-svg" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth="10"
          opacity={0.35}
        />
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = c * frac;
          const circle = (
            <circle
              key={`${seg.label}-${i}`}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="10"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 50 50)"
              className="admin-analytics-donut-segment"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <ul className="admin-analytics-donut-legend">
        {segments.map((seg, i) => (
          <li key={`${seg.label}-${i}`}>
            <span
              className="admin-analytics-donut-dot"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="capitalize">{seg.label}</span>
            <span>{Math.round((seg.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GaugeChart({ value, label }: { value: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  const r = 38;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;
  const ringStyle = {
    "--gauge-offset-start": c,
    "--gauge-offset-end": c - dash,
  } as CSSProperties;

  return (
    <div className="admin-analytics-gauge-wrap">
      <svg viewBox="0 0 100 100" className="admin-analytics-gauge-svg" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth="8"
          opacity={0.35}
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgb(var(--success))"
          strokeWidth="8"
          strokeDasharray={`${c} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          className="admin-analytics-gauge-ring"
          style={ringStyle}
        />
      </svg>
      <div className="admin-analytics-gauge-center">
        <span className="admin-analytics-gauge-value">{clamped}%</span>
        <span className="admin-analytics-gauge-label">{label}</span>
      </div>
    </div>
  );
}

type AnalyticsIconVariant =
  | "orders"
  | "revenue"
  | "customers"
  | "wallet"
  | "avg-order"
  | "order-status"
  | "supplier"
  | "payments";

function AnalyticsCardIcon({ variant }: { variant: AnalyticsIconVariant }) {
  const gradId = useId().replace(/:/g, "");

  return (
    <span
      className={`admin-analytics-card-icon admin-analytics-card-icon--${variant}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="admin-analytics-card-icon-svg">
        <defs>
          <linearGradient id={`${gradId}-orders-1`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
          <linearGradient id={`${gradId}-orders-2`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
          <linearGradient id={`${gradId}-orders-3`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
          <linearGradient id={`${gradId}-revenue-area`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`${gradId}-revenue-line`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id={`${gradId}-trend-line`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id={`${gradId}-donut`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="33%" stopColor="#f472b6" />
            <stop offset="66%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id={`${gradId}-gauge`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        {variant === "orders" ? (
          <>
            <rect className="admin-analytics-icon-bar admin-analytics-icon-bar--1" x="4" y="13" width="3.5" height="7" rx="0.8" fill={`url(#${gradId}-orders-1)`} />
            <rect className="admin-analytics-icon-bar admin-analytics-icon-bar--2" x="10.25" y="9" width="3.5" height="11" rx="0.8" fill={`url(#${gradId}-orders-2)`} />
            <rect className="admin-analytics-icon-bar admin-analytics-icon-bar--3" x="16.5" y="6" width="3.5" height="14" rx="0.8" fill={`url(#${gradId}-orders-3)`} />
          </>
        ) : null}
        {variant === "revenue" ? (
          <>
            <path
              className="admin-analytics-icon-area"
              d="M3 18V6l4 3 4-5 4 4 6-7v17H3Z"
              fill={`url(#${gradId}-revenue-area)`}
            />
            <polyline
              className="admin-analytics-icon-line admin-analytics-icon-line--revenue"
              points="3,18 7,15 11,20 15,16 21,9"
              stroke={`url(#${gradId}-revenue-line)`}
            />
          </>
        ) : null}
        {variant === "customers" ? (
          <>
            <circle className="admin-analytics-icon-pulse-ring admin-analytics-icon-pulse-ring--cyan" cx="12" cy="9" r="5.5" />
            <circle className="admin-analytics-icon-head admin-analytics-icon-head--violet" cx="12" cy="9" r="2.8" />
            <path className="admin-analytics-icon-body admin-analytics-icon-body--pink" d="M5 20a7 7 0 0 1 14 0" />
          </>
        ) : null}
        {variant === "wallet" ? (
          <>
            <path className="admin-analytics-icon-wallet admin-analytics-icon-wallet--teal" d="M3 8h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" />
            <path className="admin-analytics-icon-wallet admin-analytics-icon-wallet--blue" d="M3 8V7a1 1 0 0 1 1-1h14" />
            <circle className="admin-analytics-icon-coin admin-analytics-icon-coin--gold" cx="17" cy="13" r="1.6" />
          </>
        ) : null}
        {variant === "avg-order" ? (
          <>
            <path className="admin-analytics-icon-axis" d="M4 19V5M4 19h16" />
            <polyline
              className="admin-analytics-icon-line admin-analytics-icon-line--trend"
              points="6,16 10,12 14,14 18,8"
              stroke={`url(#${gradId}-trend-line)`}
            />
            <circle className="admin-analytics-icon-dot admin-analytics-icon-dot--1" cx="6" cy="16" r="1.3" />
            <circle className="admin-analytics-icon-dot admin-analytics-icon-dot--2" cx="10" cy="12" r="1.3" />
            <circle className="admin-analytics-icon-dot admin-analytics-icon-dot--3" cx="14" cy="14" r="1.3" />
            <circle className="admin-analytics-icon-dot admin-analytics-icon-dot--4" cx="18" cy="8" r="1.3" />
          </>
        ) : null}
        {variant === "order-status" ? (
          <>
            <circle className="admin-analytics-icon-donut-track admin-analytics-icon-donut-track--amber" cx="12" cy="12" r="7.5" />
            <circle
              className="admin-analytics-icon-donut-arc"
              cx="12"
              cy="12"
              r="7.5"
              stroke={`url(#${gradId}-donut)`}
            />
          </>
        ) : null}
        {variant === "supplier" ? (
          <>
            <path className="admin-analytics-icon-gauge-track" d="M6 17a6 6 0 0 1 12 0" />
            <path
              className="admin-analytics-icon-gauge-fill"
              d="M6 17a6 6 0 0 1 12 0"
              stroke={`url(#${gradId}-gauge)`}
            />
            <circle className="admin-analytics-icon-gauge-dot admin-analytics-icon-gauge-dot--lime" cx="12" cy="17" r="1.4" />
          </>
        ) : null}
        {variant === "payments" ? (
          <>
            <rect className="admin-analytics-icon-bar admin-analytics-icon-bar--1" x="4" y="14" width="3" height="5" rx="0.6" fill={`url(#${gradId}-orders-1)`} />
            <rect className="admin-analytics-icon-bar admin-analytics-icon-bar--2" x="10.5" y="11" width="3" height="8" rx="0.6" fill={`url(#${gradId}-orders-2)`} />
            <rect className="admin-analytics-icon-bar admin-analytics-icon-bar--3" x="17" y="8" width="3" height="11" rx="0.6" fill={`url(#${gradId}-orders-3)`} />
          </>
        ) : null}
      </svg>
    </span>
  );
}

function ChartCard({
  title,
  value,
  sub,
  trend,
  className = "",
  iconVariant,
  children,
}: {
  title: string;
  value: ReactNode;
  sub?: string;
  trend?: { pct: number; up: boolean };
  className?: string;
  iconVariant: AnalyticsIconVariant;
  children: ReactNode;
}) {
  return (
    <article className={`admin-analytics-card ${className}`.trim()}>
      <header className="admin-analytics-card-head">
        <div className="admin-analytics-card-title">
          <AnalyticsCardIcon variant={iconVariant} />
          <h3>{title}</h3>
        </div>
        {sub ? <span className="admin-analytics-card-period">{sub}</span> : null}
      </header>
      <div className="admin-analytics-card-metrics">
        <p className="admin-analytics-card-value">{value}</p>
        {trend ? (
          <span
            className={
              trend.up
                ? "admin-analytics-trend admin-analytics-trend--up"
                : "admin-analytics-trend admin-analytics-trend--down"
            }
          >
            {trend.up ? "↑" : "↓"} {Math.abs(trend.pct)}%
          </span>
        ) : null}
      </div>
      <div className="admin-analytics-card-chart">{children}</div>
    </article>
  );
}

export function AdminAnimatedCharts({ data, reports }: Props) {
  const currency = data.revenue.currency;
  const wallet = data.wallet ?? {
    currency,
    total: 0,
    withBalance: 0,
  };

  const timeseries = reports?.timeseries ?? [];
  const recentTs = lastN(timeseries, 5);

  const orderBars = useMemo(() => {
    if (recentTs.length > 0) {
      return {
        values: recentTs.map((d) => d.orders),
        labels: recentTs.map((d) => monthLabel(d.date)),
      };
    }
    return {
      values: [
        data.orders.today,
        Math.max(data.orders.today, Math.round(data.orders.total * 0.08)),
        Math.max(data.orders.today, Math.round(data.orders.total * 0.12)),
        Math.max(data.orders.today, Math.round(data.orders.total * 0.1)),
        data.orders.today,
      ],
      labels: ["W1", "W2", "W3", "W4", "Now"],
    };
  }, [recentTs, data.orders]);

  const revenueArea = useMemo(() => {
    if (recentTs.length > 0) return recentTs.map((d) => d.revenue);
    return [
      data.revenue.last7Days * 0.15,
      data.revenue.last7Days * 0.22,
      data.revenue.last7Days * 0.18,
      data.revenue.last7Days * 0.28,
      data.revenue.today,
    ];
  }, [recentTs, data.revenue]);

  const revenueTrend = useMemo(() => {
    if (recentTs.length >= 2) {
      const last = recentTs[recentTs.length - 1]?.revenue ?? 0;
      const prev = recentTs[recentTs.length - 2]?.revenue ?? 0;
      const pct = pctChange(last, prev);
      return { pct, up: pct >= 0 };
    }
    return { pct: pctChange(data.revenue.today, data.revenue.last7Days / 7), up: true };
  }, [recentTs, data.revenue]);

  const customerBars = {
    values: [
      data.users.newToday,
      data.users.newLast7Days,
      data.users.newLast30Days,
    ],
    labels: ["Today", "7d", "30d"],
  };

  const orderStatusSegments = useMemo(() => {
    const entries = Object.entries(data.orders.byStatus)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (entries.length === 0) {
      return [{ label: "orders", value: data.orders.total || 1 }];
    }
    return entries.map(([label, value]) => ({ label, value }));
  }, [data.orders]);

  const paymentBars = useMemo(() => {
    const items = reports?.paymentBreakdown ?? [];
    if (items.length > 0) {
      const top = items.slice(0, 5);
      return {
        values: top.map((p) => p.count),
        labels: top.map((p) =>
          p.method.length > 5 ? `${p.method.slice(0, 4)}…` : p.method,
        ),
      };
    }
    return {
      values: [
        data.orders.pending,
        data.orders.delivered,
        data.orders.refunded,
        data.orders.today,
      ],
      labels: ["Pend", "Del", "Ref", "Today"],
    };
  }, [reports, data.orders]);

  return (
    <section className="admin-analytics-flow" aria-label="Analytics overview">
      <div className="admin-analytics-grid">
        <ChartCard
          title="Orders"
          iconVariant="orders"
          value={String(data.orders.total)}
          sub="Recent"
          trend={{
            pct: pctChange(data.orders.today, data.orders.total / 30),
            up: data.orders.today >= data.orders.total / 30,
          }}
        >
          <BarChart
            values={orderBars.values}
            labels={orderBars.labels}
            color="rgb(56 189 248)"
          />
        </ChartCard>

        <ChartCard
          title="Revenue"
          iconVariant="revenue"
          value={<PriceText amount={data.revenue.net} currency={currency} />}
          sub="Net"
          trend={revenueTrend}
        >
          <AreaChart values={revenueArea} />
        </ChartCard>

        <ChartCard
          title="Total Customers"
          iconVariant="customers"
          value={String(data.users.total)}
          sub="Growth"
          trend={{
            pct: pctChange(data.users.newToday, data.users.newLast7Days / 7),
            up: data.users.newToday >= data.users.newLast7Days / 7,
          }}
        >
          <BarChart
            values={customerBars.values}
            labels={customerBars.labels}
            color="rgb(129 140 248)"
          />
        </ChartCard>

        <ChartCard
          title="Wallet Balance"
          iconVariant="wallet"
          value={<PriceText amount={wallet.total} currency={wallet.currency} />}
          sub="Customer accounts"
          trend={{
            pct:
              data.users.total > 0
                ? Math.round((wallet.withBalance / data.users.total) * 100)
                : 0,
            up: wallet.withBalance > 0,
          }}
        >
          <BarChart
            values={[
              wallet.withBalance,
              Math.max(0, data.users.total - wallet.withBalance),
            ]}
            labels={["Funded", "Empty"]}
            color="rgb(52 211 153)"
          />
        </ChartCard>

        <ChartCard
          title="Avg order"
          iconVariant="avg-order"
          value={<PriceText amount={data.orders.averageOrderValue} currency={currency} />}
          sub="Paid"
        >
          <AreaChart
            values={[
              data.orders.averageOrderValue * 0.7,
              data.orders.averageOrderValue * 0.85,
              data.orders.averageOrderValue,
              data.orders.averageOrderValue * 0.92,
              data.orders.averageOrderValue * 1.05,
            ]}
            color="rgb(var(--brand))"
          />
        </ChartCard>

        <ChartCard
          title="Order status"
          iconVariant="order-status"
          value={String(data.orders.pending)}
          sub="Pending"
        >
          <DonutChart segments={orderStatusSegments} />
        </ChartCard>

        <ChartCard
          title="Supplier success"
          iconVariant="supplier"
          value={`${data.suppliers.procurement.successRate}%`}
          sub="Fulfillment"
        >
          <GaugeChart
            value={data.suppliers.procurement.successRate}
            label="Success"
          />
        </ChartCard>

        <ChartCard
          title="Payments"
          iconVariant="payments"
          value={String(
            reports?.paymentBreakdown.reduce((s, p) => s + p.count, 0) ??
              data.orders.total,
          )}
          sub="Methods"
        >
          <BarChart
            values={paymentBars.values}
            labels={paymentBars.labels}
            color="rgb(var(--brand))"
          />
        </ChartCard>
      </div>
    </section>
  );
}
