"use client";

import { useEffect, useState } from "react";
import {
  FileIcon,
  StarIcon,
  TruckIcon,
} from "@/components/admin/icons";
import {
  fetchProductReviews,
  PRODUCT_REVIEWS_PAGE_SIZE,
  type ProductReviewsSummary,
  type PublicProductReview,
  type SubmittedProductReview,
} from "@/lib/api";
import { RegionIcon } from "@/components/ui/RegionIcon";
import { hasProductHtmlContent } from "@/lib/product-page";
import { ProductDetailReviewsPanel } from "@/components/product/ProductDetailReviewsPanel";

export type ProductInfoTabId = "description" | "reviews" | "shipping";

const TABS: readonly {
  id: ProductInfoTabId;
  label: string;
}[] = [
  { id: "description", label: "Product Description" },
  { id: "reviews", label: "Reviews" },
  { id: "shipping", label: "Shipping & Delivery" },
];

type Props = {
  productId: string;
  productTitle: string;
  productDescription: string;
  deliveryType?: string;
  availableRegions?: string[];
  ratings?: { avg: number; count: number };
  tab: ProductInfoTabId;
  onTabChange: (tab: ProductInfoTabId) => void;
};

function tabIcon(id: ProductInfoTabId) {
  const iconCls = "h-4 w-4 shrink-0";
  if (id === "reviews") {
    return <StarIcon className={iconCls} strokeWidth={2} aria-hidden />;
  }
  if (id === "shipping") {
    return <TruckIcon className={iconCls} strokeWidth={2} aria-hidden />;
  }
  return <FileIcon className={iconCls} strokeWidth={2} aria-hidden />;
}

export function ProductDetailInfoTabs({
  productId,
  productTitle,
  productDescription,
  deliveryType,
  availableRegions,
  ratings,
  tab,
  onTabChange,
}: Props) {
  const [reviews, setReviews] = useState<PublicProductReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ProductReviewsSummary>({
    avg: ratings?.avg ?? 0,
    count: ratings?.count ?? 0,
    distribution: [0, 0, 0, 0, 0],
  });
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  useEffect(() => {
    setReviewsPage(1);
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    setReviewsLoading(true);
    fetchProductReviews(productId, reviewsPage, PRODUCT_REVIEWS_PAGE_SIZE)
      .then((result) => {
        if (!cancelled) {
          setReviews(result.items);
          setReviewsTotal(result.total);
          setReviewSummary(result.summary);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReviewsLoading(false);
          setReviewsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productId, reviewsPage]);

  const reviewCount = reviewSummary.count || ratings?.count || 0;
  const reviewAvg = reviewSummary.count > 0 ? reviewSummary.avg : (ratings?.avg ?? 0);

  function handleReviewSubmitted(review: SubmittedProductReview) {
    if (review.status !== "published") return;
    setReviewsPage(1);
    fetchProductReviews(productId, 1, PRODUCT_REVIEWS_PAGE_SIZE)
      .then((result) => {
        setReviews(result.items);
        setReviewsTotal(result.total);
        setReviewSummary(result.summary);
      })
      .catch(() => {});
  }

  return (
    <div className="customer-panel min-w-0">
      <section className="dashboard-pro-card admin-order-view-card admin-order-view-sidebar-card admin-order-view-sidebar-card--items admin-order-view-sidebar-card--pro admin-product-form-section product-pdp-info-tabs">
        <div className="product-pdp-info-tab-shell">
          <div
            className="product-pdp-info-tab-nav"
            role="tablist"
            aria-label="Product information"
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  id={`pdp-tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`pdp-panel-${t.id}`}
                  onClick={() => onTabChange(t.id)}
                  className={`product-pdp-info-tab-btn${
                    active ? " product-pdp-info-tab-btn--active" : ""
                  }`}
                >
                  <span
                    className="product-pdp-info-tab-icon dashboard-pro-section-icon shrink-0"
                    aria-hidden
                  >
                    {tabIcon(t.id)}
                  </span>
                  <span className="product-pdp-info-tab-label dashboard-pro-section-title min-w-0">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="admin-order-view-card-body">
          <div className="admin-order-view-pro-section-panel admin-order-view-detail-row admin-order-view-detail-row--stacked">
            {tab === "description" ? (
              <div
                id="pdp-panel-description"
                role="tabpanel"
                aria-labelledby="pdp-tab-description"
                tabIndex={0}
                className="product-pdp-description space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                      Product details
                    </p>
                    <h2 className="text-base font-semibold text-foreground sm:text-lg">
                      About {productTitle}
                    </h2>
                  </div>
                  <span className="dashboard-pro-status dashboard-pro-status--brand shrink-0">
                    Digital product
                  </span>
                </div>
                {hasProductHtmlContent(productDescription) ? (
                  <div
                    className="rich-editor-body product-pdp-prose"
                    dangerouslySetInnerHTML={{ __html: productDescription }}
                  />
                ) : (
                  <div className="product-pdp-description-empty dashboard-pro-empty py-8">
                    <span className="dashboard-pro-empty-icon" aria-hidden>
                      <FileIcon className="h-6 w-6" />
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      No detailed description
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      A full product description has not been added yet.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {tab === "reviews" ? (
              <ProductDetailReviewsPanel
                id="pdp-panel-reviews"
                aria-labelledby="pdp-tab-reviews"
                productId={productId}
                reviews={reviews}
                reviewsLoading={reviewsLoading}
                reviewsLoaded={reviewsLoaded}
                reviewAvg={reviewAvg}
                reviewCount={reviewCount}
                reviewSummary={reviewSummary}
                reviewsPage={reviewsPage}
                reviewsTotal={reviewsTotal}
                pageSize={PRODUCT_REVIEWS_PAGE_SIZE}
                onPageChange={setReviewsPage}
                onReviewSubmitted={handleReviewSubmitted}
              />
            ) : null}

            {tab === "shipping" ? (
              <div
                id="pdp-panel-shipping"
                role="tabpanel"
                aria-labelledby="pdp-tab-shipping"
                tabIndex={0}
                className="space-y-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                    Shipping & delivery
                  </p>
                  <h2 className="text-base font-semibold text-foreground sm:text-lg">
                    Instant digital delivery
                  </h2>
                </div>
                <ul className="space-y-2 text-foreground-muted">
                  <li>
                    • Orders are delivered digitally after payment confirmation.
                  </li>
                  <li>
                    • Typical delivery window: 5–15 minutes (সাধারণত ৫-১৫ মিনিটের
                    মধ্যে ডেলিভারি)।
                  </li>
                  <li>• Delivery type: {deliveryType ?? "auto"}</li>
                  {availableRegions && availableRegions.length > 0 ? (
                    <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>• Available regions:</span>
                      {availableRegions.map((region) => (
                        <span
                          key={region}
                          className="inline-flex items-center gap-1"
                        >
                          <RegionIcon region={region} size={16} />
                          <span>{region}</span>
                        </span>
                      ))}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
