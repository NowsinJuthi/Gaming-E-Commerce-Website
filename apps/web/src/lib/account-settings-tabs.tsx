"use client";

import type { ReactNode } from "react";
import {
  BellIcon,
  GridIcon,
  LockIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
} from "@/components/admin/icons";

export type SettingsTab =
  | "profile"
  | "security"
  | "devices"
  | "notifications"
  | "kyc"
  | "appearance";

type TabDef = {
  id: SettingsTab;
  label: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
};

export const SETTINGS_TABS: readonly TabDef[] = [
  {
    id: "profile",
    label: "Profile",
    title: "Profile",
    subtitle: "Name, photo, contact details, and public bio",
    icon: <UserIcon className="h-4 w-4" />,
  },
  {
    id: "security",
    label: "Security",
    title: "Security",
    subtitle: "Update your password and protect account access",
    icon: <LockIcon className="h-4 w-4" />,
  },
  {
    id: "appearance",
    label: "Appearance",
    title: "Appearance",
    subtitle: "Theme mode and accent color on this device",
    icon: <SunIcon className="h-4 w-4" />,
  },
  {
    id: "devices",
    label: "Devices",
    title: "Devices",
    subtitle: "Active sessions and signed-in devices",
    icon: <GridIcon className="h-4 w-4" />,
  },
  {
    id: "notifications",
    label: "Notifications",
    title: "Notifications",
    subtitle: "Channels, event alerts, Telegram, and push tokens",
    icon: <BellIcon className="h-4 w-4" />,
  },
  {
    id: "kyc",
    label: "KYC",
    title: "KYC verification",
    subtitle: "Submit identity documents for account verification",
    icon: <ShieldIcon className="h-4 w-4" />,
  },
];

export function isSettingsTab(value: string): value is SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.id === value);
}
