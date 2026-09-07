"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APPEARANCE_NAV } from "@/lib/appearance-nav";

export function AppearanceSubnav() {
  const pathname = usePathname();

  return (
    <div className="admin-appearance-subnav flex flex-wrap gap-2">
      {APPEARANCE_NAV.map((item) => {
        const active =
          pathname === item.href || pathname?.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`admin-appearance-subnav-link inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold${
              active ? " admin-appearance-subnav-link--active" : ""
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
