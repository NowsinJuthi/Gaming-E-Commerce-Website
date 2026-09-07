"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EMAIL_SETTINGS_NAV_ITEMS } from "@/lib/email-settings-nav";

export function EmailSettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Email settings sections"
    >
      {EMAIL_SETTINGS_NAV_ITEMS.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Link
            key={item.href}
            href={{ pathname: item.href }}
            className={`${navClass(active)} shrink-0 whitespace-nowrap`}
            aria-current={active ? "page" : undefined}
          >
            {item.navLabel}
          </Link>
        );
      })}
    </nav>
  );
}

function navClass(active: boolean) {
  return active
    ? "panel-3d-btn panel-3d-btn-sm inline-flex"
    : "panel-3d-btn-ghost panel-3d-btn-sm inline-flex";
}
