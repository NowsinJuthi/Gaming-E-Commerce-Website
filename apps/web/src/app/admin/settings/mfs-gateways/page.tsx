"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminMfsGatewaysRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/settings/payments?tab=mfs");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="dashboard-loading">Opening MFS gateways…</p>
    </div>
  );
}
