/** Customer-facing order status copy (differs from admin DB labels). */

export const CUSTOMER_ORDER_TRACKER_STEPS = [
  "pending",
  "paid",
  "processing",
  "delivered",
] as const;

export function customerOrderStatusLabel(status: string): string {
  switch (status) {
    case "delivered":
      return "Completed";
    case "paid":
    case "processing":
      return "Processing";
    case "pending":
      return "Pending";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

/** Paid and processing both highlight the fulfillment step for customers. */
export function customerOrderTrackerIndex(status: string): number {
  if (status === "paid" || status === "processing") {
    return CUSTOMER_ORDER_TRACKER_STEPS.indexOf("processing");
  }
  return CUSTOMER_ORDER_TRACKER_STEPS.indexOf(
    status as (typeof CUSTOMER_ORDER_TRACKER_STEPS)[number],
  );
}
