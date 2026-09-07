export const ADMIN_REPORT_DAY_OPTIONS = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "365", label: "Last 1 year", days: 365 },
] as const;

export type AdminReportDays =
  (typeof ADMIN_REPORT_DAY_OPTIONS)[number]["days"];

export function adminReportSelectOptions() {
  return ADMIN_REPORT_DAY_OPTIONS.map(({ value, label }) => ({ value, label }));
}

export function formatAdminReportRangeLabel(
  reportDays: number,
  range?: { from?: string; to?: string },
): string {
  if (range?.from && range?.to) {
    const start = new Date(range.from);
    const end = new Date(range.to);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }
  const preset = ADMIN_REPORT_DAY_OPTIONS.find((o) => o.days === reportDays);
  if (preset) return preset.label;
  return `Last ${reportDays} days`;
}
