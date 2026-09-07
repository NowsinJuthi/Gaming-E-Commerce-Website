"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

type AdminLicenseNoteProps = {
  children: ReactNode;
  actionHref?: Route;
  actionLabel?: string;
  variant?: "gold" | "sky";
};

export function AdminLicenseNote({
  children,
  actionHref = "/admin/settings/license",
  actionLabel = "Activate License Key",
  variant = "gold",
}: AdminLicenseNoteProps) {
  const shell =
    variant === "sky"
      ? "border-sky-500/35 bg-gradient-to-br from-sky-500/14 to-sky-500/5"
      : "border-amber-400/35 bg-gradient-to-br from-amber-400/14 to-amber-500/5";
  const linkTone =
    variant === "sky"
      ? "text-sky-300 hover:text-sky-200"
      : "text-amber-300 hover:text-amber-200";

  return (
    <div
      className={`admin-license-note flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${shell}`}
    >
      <div className="min-w-0 text-sm leading-relaxed text-foreground-muted [&_p]:m-0">
        {children}
      </div>
      {actionHref ? (
        <Link
          href={actionHref}
          className={`shrink-0 text-sm font-semibold no-underline hover:underline ${linkTone}`}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
