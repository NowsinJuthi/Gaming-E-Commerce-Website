import { useAdminCenterToastStore } from "@/stores/admin-center-toast-store";

export function adminToast(text: string, ok = true) {
  useAdminCenterToastStore.getState().show(text, ok);
}

export function hideAdminToast() {
  useAdminCenterToastStore.getState().hide();
}
