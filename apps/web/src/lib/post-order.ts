import { hasAuthSession } from "@/lib/access-token";
import type { Route } from "next";
import type { OrderDetail } from "@/lib/api";
import { resolveOrderId } from "@/lib/api";
import { isRegisteredUserLoggedIn } from "@/lib/guest-checkout";

export function isUserLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return hasAuthSession();
}

type PostOrderOptions = {
  loggedIn?: boolean;
  /** Signed guest receipt token from the API — never put contact email in URLs. */
  guestReceiptToken?: string;
};

/** Where to send the buyer after a successful order. */
export function getPostOrderRedirectPath(
  order: Pick<OrderDetail, "_id" | "orderNumber" | "guestReceiptToken">,
  options: PostOrderOptions = {},
): Route {
  const loggedIn = options.loggedIn ?? isRegisteredUserLoggedIn();
  if (loggedIn) {
    const orderId = resolveOrderId(order);
    return (orderId ? `/orders/${orderId}` : "/orders") as Route;
  }

  const token = (options.guestReceiptToken ?? order.guestReceiptToken)?.trim();
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  } else if (order.orderNumber) {
    params.set("order", order.orderNumber);
  }
  const query = params.toString();
  return (query ? `/order/thank-you?${query}` : "/order/thank-you") as Route;
}
