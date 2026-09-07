"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isSettingsTab } from "@/lib/account-settings-tabs";

export default function AccountSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    router.replace(
      tab && isSettingsTab(tab) ? `/profile?tab=${tab}` : "/profile",
    );
  }, [router, searchParams]);

  return null;
}
