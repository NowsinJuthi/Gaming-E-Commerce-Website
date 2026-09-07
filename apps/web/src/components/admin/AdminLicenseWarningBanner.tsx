"use client";

import { usePathname } from "next/navigation";
import { AdminLicenseNote } from "@/components/admin/AdminLicenseNote";
import { useLicenseStatus } from "@/hooks/useLicenseStatus";

export function AdminLicenseWarningBanner() {
  const pathname = usePathname();
  const { status, loading } = useLicenseStatus();

  if (loading || !status) return null;
  if (status.devBypass || status.valid) return null;
  if (pathname === "/admin/settings/license") return null;

  const message = !status.serverReady
    ? "Server vendor config is missing. Licensed features stay locked until the server is configured and a license key is activated."
    : !status.configured
      ? "No license key is active. Payment gateways, email, live chat and other licensed settings stay locked until you activate a key."
      : "Your license key is saved but not active. Licensed features stay locked until validation succeeds.";

  return (
    <div className="mb-5">
      <AdminLicenseNote>{message}</AdminLicenseNote>
    </div>
  );
}
