export type AccountSectionProps = {
  /** Flat profile-page layout inside customer-profile-edit-card. */
  embedded?: boolean;
};

export function accountSectionStackClass(embedded?: boolean) {
  return embedded
    ? "customer-profile-form-stack w-full space-y-4 sm:space-y-5"
    : "w-full space-y-5";
}

export function accountPanelClass(embedded?: boolean, extra?: string) {
  const base = embedded ? "customer-profile-form-panel" : "shell-panel";
  return extra ? `${base} ${extra}`.trim() : base;
}

export function accountInsetPanelClass(embedded?: boolean, extra?: string) {
  const base = embedded
    ? "rounded-lg border border-border/50 bg-muted/10 p-3 sm:rounded-xl sm:p-3.5"
    : "shell-panel";
  return extra ? `${base} ${extra}`.trim() : base;
}
