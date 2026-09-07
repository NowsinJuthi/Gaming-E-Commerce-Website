type GuestOrderLink = {
  orderNumber?: string;
  /** Signed guest receipt token — never put contact email in URLs. */
  guestAccessToken?: string;
};

/** Public thank-you page for buyers without an account. */
export function buildGuestThankYouPath(order: GuestOrderLink): string {
  const params = new URLSearchParams();
  if (order.guestAccessToken?.trim()) {
    params.set('token', order.guestAccessToken.trim());
    const query = params.toString();
    return query ? `/order/thank-you?${query}` : '/order/thank-you';
  }
  if (order.orderNumber?.trim()) {
    params.set('order', order.orderNumber.trim());
  }
  const query = params.toString();
  return query ? `/order/thank-you?${query}` : '/order/thank-you';
}

/**
 * Order link for customer emails. Registered buyers use the account order page;
 * guest checkout uses a signed thank-you token (no email in query string).
 */
export function buildCustomerOrderEmailPath(
  order: GuestOrderLink & { _id?: unknown },
  isGuestBuyer: boolean,
  guestAccessToken?: string,
): string {
  if (isGuestBuyer) {
    return buildGuestThankYouPath({
      orderNumber: order.orderNumber,
      guestAccessToken,
    });
  }
  const id = order._id != null ? String(order._id) : '';
  return id ? `/orders/${id}` : '/orders';
}
