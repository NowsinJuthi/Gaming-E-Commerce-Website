export type EmailTemplateSendMeta = {
  wired: boolean;
  hint?: string;
};

/** How each template toggle maps to real send behavior (orders category). */
export const ORDER_TEMPLATE_SEND_META: Record<string, EmailTemplateSendMeta> = {
  "order.new_admin": {
    wired: true,
    hint: "Also requires Admin order alert emails in Email settings.",
  },
  "order.pending": { wired: true },
  "order.paid": {
    wired: true,
    hint: "Payment receipt. Takes priority over Invoice.",
  },
  "order.invoice": {
    wired: true,
    hint: "Sends only when Paid Order is disabled.",
  },
  "order.processing": {
    wired: true,
    hint: "Skipped after payment confirmation email was sent.",
  },
  "order.completed": { wired: true },
  "order.cancelled": { wired: true },
  "order.refunded": { wired: true },
  "order.failed": { wired: true },
  "order.customer_note": { wired: true },
  "order.on_hold": {
    wired: false,
    hint: "Not wired yet — toggle has no effect.",
  },
  "order.gift_card": {
    wired: false,
    hint: "Codes are sent via Completed Order for now.",
  },
};

export function getOrderTemplateSendMeta(
  templateId: string,
): EmailTemplateSendMeta | null {
  return ORDER_TEMPLATE_SEND_META[templateId] ?? null;
}
