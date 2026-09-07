"use client";

import Link from "next/link";
import { useLicenseStatus } from "@/hooks/useLicenseStatus";
import { isLicenseRouteAllowed, licenseFeatureForPath } from "@/lib/license-features";

export function AdminLicenseFeatureNotice({ path }: { path: string }) {
  const { status, loading } = useLicenseStatus();
  if (loading || !status) return null;

  if (status.devBypass) {
    return (
      <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
        <p className="font-medium text-sky-50">Development — license not configured</p>
        <p className="mt-1 text-sky-100/90">
          All features are unlocked in local dev mode. For production, open{" "}
          <Link href="/admin/settings/license" className="underline">
            License settings
          </Link>{" "}
          to save your key and activate.
        </p>
      </div>
    );
  }

  if (isLicenseRouteAllowed(path, status.features)) {
    return null;
  }

  const feature = licenseFeatureForPath(path);

  if (!status.configured && !status.valid && !status.devBypass) {
    return (
      <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <p className="font-medium text-amber-50">License key required</p>
        <p className="mt-1 text-amber-100/90">
          {status.serverReady === false
            ? "Server vendor config is missing — contact your deploy provider."
            : "Activate your website with a license key."}{" "}
          <Link href="/admin/settings/license" className="underline">
            License settings
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <p className="font-medium text-amber-50">License feature required</p>
      <p className="mt-1 text-amber-100/90">
        {feature
          ? `The "${feature}" feature is not enabled on your Amarpin license.`
          : "This settings area is not enabled on your license."}{" "}
        Open{" "}
        <Link href="/admin/settings/license" className="underline">
          License settings
        </Link>{" "}
        to activate your key or contact support.
      </p>
    </div>
  );
}
