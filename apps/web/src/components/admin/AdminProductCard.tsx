"use client";

import Link from "next/link";
import {
  BoxIcon,
  EyeIcon,
  StarIcon,
} from "@/components/admin/icons";
import { PriceText } from "@/components/ui/PriceText";
import type { AdminProduct, ProductStatusValue } from "@/lib/api";
import { productPath } from "@/lib/seo";

type CardTone = "success" | "amber" | "processing" | "muted";
type StatusMeta = {
  label: string;
  tone: CardTone;
  badgeTone: "success" | "amber" | "processing" | "muted";
};

const STATUS_META: Record<ProductStatusValue, StatusMeta> = {
  active: { label: "Active", tone: "success", badgeTone: "success" },
  draft: { label: "Draft", tone: "muted", badgeTone: "muted" },
  out_of_stock: { label: "Out of stock", tone: "amber", badgeTone: "amber" },
  archived: { label: "Archived", tone: "muted", badgeTone: "muted" },
};

const TYPE_LABEL: Record<string, string> = {
  license: "License",
  account: "Account",
  giftcard: "Gift card",
  topup: "Top-up",
  subscription: "Subscription",
};

type Props = {
  product: AdminProduct;
  thumbUrl: string;
  availableStock: number;
  onToggleFeatured: () => void;
  onDelete: () => void;
  togglingFeatured?: boolean;
  deleting?: boolean;
  disabled?: boolean;
};

export function AdminProductCard({
  product,
  thumbUrl,
  availableStock,
  onToggleFeatured,
  onDelete,
  togglingFeatured = false,
  deleting = false,
  disabled = false,
}: Props) {
  const status: ProductStatusValue = product.status ?? "draft";
  const meta = STATUS_META[status];
  const typeLabel = TYPE_LABEL[product.type] ?? product.type;
  const stockLow = availableStock < 5 && status !== "archived";

  return (
    <article
      className={`admin-product-card dashboard-recent-order dashboard-recent-order--${meta.tone}`}
    >
      <span className="dashboard-recent-order-accent" aria-hidden />

      <div className="dashboard-recent-order-inner">
        <div className="dashboard-recent-order-main">
          <span className="dashboard-recent-order-icon overflow-hidden" aria-hidden>
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <BoxIcon className="h-4 w-4" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="dashboard-recent-order-header">
              <div className="dashboard-recent-order-title-block min-w-0">
                <p className="dashboard-recent-order-title truncate">
                  {product.title}
                </p>
                <p className="dashboard-recent-order-meta">
                  {typeLabel}
                  {" · "}
                  <PriceText
                    amount={product.pricing?.basePrice ?? 0}
                    currency={product.pricing?.currency ?? "BDT"}
                  />
                  {" · Stock "}
                  <span
                    className={
                      stockLow
                        ? "font-semibold text-amber-300"
                        : availableStock <= 0 && status !== "archived"
                          ? "font-semibold text-rose-300"
                          : ""
                    }
                  >
                    {availableStock}
                    {stockLow ? " low" : ""}
                  </span>
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-subtle">
                  /{product.slug}
                  {product.sku ? ` · ${product.sku}` : ""}
                </p>
              </div>
              <span
                className={`dashboard-recent-order-badge dashboard-recent-order-badge--${meta.badgeTone}`}
              >
                {meta.label}
              </span>
            </div>
          </div>
        </div>

        <div className="dashboard-recent-order-actions">
          <button
            type="button"
            title={product.featured ? "Remove from featured" : "Mark as featured"}
            disabled={disabled || togglingFeatured || deleting}
            onClick={onToggleFeatured}
            className={`dashboard-recent-order-view admin-product-card-featured-btn${
              product.featured ? " is-featured" : ""
            } disabled:opacity-40`}
            aria-label={
              product.featured ? "Remove from featured" : "Mark as featured"
            }
            aria-pressed={product.featured ?? false}
          >
            <StarIcon
              className={`admin-product-card-featured-star h-4 w-4${
                product.featured
                  ? " admin-product-card-featured-star--filled"
                  : ""
              }`}
              aria-hidden
            />
            <span className="dashboard-recent-order-view-label">Featured</span>
          </button>
          {product.slug.trim() ? (
            <Link
              href={productPath(product.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="dashboard-recent-order-view"
            >
              <EyeIcon className="h-4 w-4" aria-hidden />
              <span className="dashboard-recent-order-view-label">View</span>
            </Link>
          ) : null}
          <Link
            href={`/admin/products/${product._id}/edit`}
            className="dashboard-recent-order-view"
          >
            <span className="dashboard-recent-order-view-label">Edit</span>
          </Link>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled || deleting || togglingFeatured}
            className="dashboard-recent-order-view text-rose-300 hover:text-rose-200 disabled:opacity-40"
          >
            <span className="dashboard-recent-order-view-label">
              {deleting ? "Deleting…" : "Delete"}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
