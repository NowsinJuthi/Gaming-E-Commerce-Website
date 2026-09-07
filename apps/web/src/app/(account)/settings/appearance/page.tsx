"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppearanceSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile?tab=appearance");
  }, [router]);

  return null;
}
