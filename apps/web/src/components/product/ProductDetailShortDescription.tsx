"use client";

import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { sanitizeHtml } from "@/lib/sanitize";

const SHORT_DESC_ICON = (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

type Props = {
  html: string;
};

export function ProductDetailShortDescription({ html }: Props) {
  const safeHtml = sanitizeHtml(html);
  return (
    <div className="customer-panel min-w-0">
      <ProductFormOrderCard
        className="admin-product-form-section product-pdp-short-description"
        icon={SHORT_DESC_ICON}
        title="Short description"
      >
        <div
          className="rich-editor-body product-pdp-short-body"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </ProductFormOrderCard>
    </div>
  );
}
