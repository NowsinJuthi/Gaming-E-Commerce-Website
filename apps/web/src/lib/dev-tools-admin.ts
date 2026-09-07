import { hasAdminRole } from "@/lib/auth-roles";

export const DEV_TOOLS_ADMIN_CLASS = "dev-tools-admin";

export function isDevToolsAdminViewer(): boolean {
  if (typeof window === "undefined") return false;
  return hasAdminRole(null, localStorage.getItem("accessToken"));
}

export function syncDevToolsAdminVisibility(): void {
  if (typeof document === "undefined") return;

  const isAdmin = isDevToolsAdminViewer();
  document.documentElement.classList.toggle(DEV_TOOLS_ADMIN_CLASS, isAdmin);
}
