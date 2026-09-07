"use client";

import { AdminLicenseNote } from "@/components/admin/AdminLicenseNote";
import { useLicenseStatus } from "@/hooks/useLicenseStatus";
import { isLicenseRouteAllowed, licenseFeatureForPath } from "@/lib/license-features";

export function AdminLicenseFeatureNotice({ path }: { path: string }) {
  const { status, loading } = useLicenseStatus();
  if (loading || !status) return null;

  if (status.devBypass) {
    return (
      <div className="mb-5">
        <AdminLicenseNote variant="sky" actionLabel="License settings">
          <p className="font-medium text-sky-50">Development — license not configured</p>
          <p className="mt-1 text-sky-100/90">
            All features are unlocked in local dev mode. Enter a license key before
            production deploy.
          </p>
        </AdminLicenseNote>
      </div>
    );
  }

  if (isLicenseRouteAllowed(path, status.features)) {
    return null;
  }

  const feature = licenseFeatureForPath(path);

  if (!status.configured && !status.valid && !status.devBypass) {
    return (
      <div className="mb-5">
        <AdminLicenseNote>
          <p className="font-medium text-amber-50">License key required</p>
          <p className="mt-1 text-amber-100/90">
            {status.serverReady === false
              ? "Server vendor config is missing — contact your deploy provider, then activate a license key."
              : "This settings area stays locked until you activate a valid license key."}
          </p>
        </AdminLicenseNote>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <AdminLicenseNote>
        <p className="font-medium text-amber-50">License feature required</p>
        <p className="mt-1 text-amber-100/90">
          {feature
            ? `The "${feature}" feature is not enabled on your Amarpin license.`
            : "This settings area is not enabled on your license."}{" "}
          Activate your key or contact support.
        </p>
      </AdminLicenseNote>
    </div>
  );
}
