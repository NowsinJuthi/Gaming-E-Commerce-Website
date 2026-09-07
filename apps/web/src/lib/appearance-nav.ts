import { StoreIcon, SunIcon } from "@/components/admin/icons";
import type { AdminIcon } from "@/lib/admin-nav";

export type AppearanceNavItem = {
  href: "/admin/settings/appearance/logos" | "/admin/settings/appearance/theme";
  label: string;
  description: string;
  icon: AdminIcon;
};

export const APPEARANCE_NAV: [
  AppearanceNavItem,
  ...AppearanceNavItem[],
] = [
  {
    href: "/admin/settings/appearance/logos",
    label: "Logos",
    description: "Site logos, admin favicon, and brand identity",
    icon: StoreIcon,
  },
  {
    href: "/admin/settings/appearance/theme",
    label: "Theme & colors",
    description: "Default theme, accent, brand, and palettes",
    icon: SunIcon,
  },
];

export function getAppearanceMeta(pathname: string | null): AppearanceNavItem {
  const match = APPEARANCE_NAV.find(
    (item) => pathname === item.href || pathname?.startsWith(`${item.href}/`),
  );
  return match ?? APPEARANCE_NAV[0];
}
