"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightIcon,
  KeyIcon,
  ShieldIcon,
} from "@/components/admin/icons";
import { useLicenseStatus } from "@/hooks/useLicenseStatus";

export function AdminLicenseWarningBanner() {
  const pathname = usePathname();
  const { status, loading } = useLicenseStatus();

  if (loading || !status) return null;
  if (status.devBypass || status.valid) return null;
  if (pathname === "/admin/settings/license") return null;

  const content = !status.serverReady
    ? {
        eyebrow: "Configuration required",
        title: "Complete your license setup",
        message:
          "The server vendor configuration is missing. Contact your deployment provider, then activate a valid license key.",
      }
    : !status.configured
      ? {
          eyebrow: "License required",
          title: "Activate your UniQbd license",
          message:
            "Unlock payment gateways, email, live chat, delivery and other premium settings with a valid license key.",
        }
      : {
          eyebrow: "Verification required",
          title: "Your license needs attention",
          message:
            "A license key is saved, but validation has not succeeded. Validate or reactivate it to restore licensed features.",
        };

  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-amber-400/25 bg-[linear-gradient(115deg,rgba(245,158,11,0.16),rgba(245,158,11,0.06)_45%,rgba(15,23,42,0.15))] shadow-[0_14px_45px_-28px_rgba(245,158,11,0.8)]">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700" />

      <div className="relative flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <div className="relative mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/25 bg-amber-400/15 text-amber-300 shadow-inner shadow-amber-200/10">
            <ShieldIcon className="h-5 w-5" />
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-[rgb(var(--background))] bg-amber-400 text-amber-950">
              <KeyIcon className="h-2.5 w-2.5" />
            </span>
          </div>

          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-amber-50 sm:text-base">
                {content.title}
              </p>
              <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">
                {content.eyebrow}
              </span>
            </div>
            <p className="max-w-3xl text-xs leading-relaxed text-amber-100/75 sm:text-sm">
              {content.message}
            </p>
            <p className="mt-2 text-[11px] font-medium text-amber-200/60">
              Payments&nbsp; • &nbsp;Email&nbsp; • &nbsp;Live chat&nbsp; •
              &nbsp;Delivery
            </p>
          </div>
        </div>

        <Link
          href="/admin/settings/license"
          className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 text-sm font-bold text-amber-950 no-underline shadow-lg shadow-amber-500/15 transition hover:-translate-y-0.5 hover:from-amber-300 hover:to-yellow-400 hover:shadow-amber-500/25"
        >
          <KeyIcon className="h-4 w-4" />
          Activate license
          <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
