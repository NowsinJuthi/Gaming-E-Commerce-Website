"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ProductImageGallery,
  type ProductImageItem,
} from "@/components/admin/product-image-gallery";
import {
  RichTextSection,
  RICH_EDITOR_SINGLE_LINE_PREVIEW_HEIGHT,
} from "@/components/admin/rich-text-editor";
import {
  parseCustomerInputBoxes,
  ProductCustomerInputs,
  serializeCustomerInputBoxes,
  type CustomerInputBox,
} from "@/components/admin/product-customer-inputs";
import {
  parseStoredVariations,
  ProductVariations,
  serializeVariations,
  type ProductStockContext,
  type ProductVariation,
} from "@/components/admin/product-variations";
import { PriceText } from "@/components/ui/PriceText";
import {
  flattenCategories,
  type AdminProduct,
  type Brand,
  type Category,
  type ProductInput,
  type ProductStatusValue,
  type ProductTypeValue,
} from "@/lib/api";
import { productPath } from "@/lib/seo";
import { slugify } from "@/lib/slugify";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { AdminSeoSerpPreview } from "@/components/admin/AdminSeoSerpPreview";
import { AdminProductSeoScorePanel } from "@/components/admin/AdminProductSeoScorePanel";

export const PRODUCT_STATUSES: ProductStatusValue[] = [
  "draft",
  "active",
  "out_of_stock",
  "archived",
];

export const STATUS_LABEL: Record<ProductStatusValue, string> = {
  draft: "Draft",
  active: "Active",
  out_of_stock: "Out of stock",
  archived: "Archived",
};

const STATUS_STYLE: Record<ProductStatusValue, string> = {
  draft: "dashboard-pro-status dashboard-pro-status--amber",
  active: "dashboard-pro-status dashboard-pro-status--green",
  out_of_stock: "dashboard-pro-status dashboard-pro-status--amber",
  archived:
    "dashboard-pro-status border border-border/48 bg-muted/30 text-foreground-muted",
};

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          done
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
            : "bg-muted/40 text-subtle ring-1 ring-border/60"
        }`}
        aria-hidden
      >
        {done ? "✓" : "·"}
      </span>
      <span className={done ? "text-foreground" : "text-foreground-muted"}>
        {label}
      </span>
    </li>
  );
}

export const productInputCls =
  "admin-input w-full text-foreground placeholder:text-subtle";

export const productLabelCls = "admin-filter-label";

const DEFAULT_PRODUCT_CURRENCY = "BDT";

function getVariationBasePrice(variations: ProductVariation[]): number {
  const prices = variations
    .map((v) => v.price)
    .filter((p) => Number.isFinite(p) && p >= 0);
  return prices.length > 0 ? Math.min(...prices) : 0;
}

export type ProductFormState = {
  title: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  type: ProductTypeValue;
  deliveryType: "auto" | "manual";
  status: ProductStatusValue;
  featured: boolean;
  categoryIds: string[];
  brandId: string;
  regions: string;
  defaultRegion: string;
  mediaItems: ProductImageItem[];
  showVariationImagesInGallery: boolean;
  variations: ProductVariation[];
  customerInputBoxes: CustomerInputBox[];
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
};

export const EMPTY_PRODUCT_FORM: ProductFormState = {
  title: "",
  slug: "",
  sku: "",
  shortDescription: "",
  description: "",
  type: "license",
  deliveryType: "auto",
  status: "active",
  featured: false,
  categoryIds: [],
  brandId: "",
  regions: "GLOBAL",
  defaultRegion: "",
  mediaItems: [],
  showVariationImagesInGallery: false,
  variations: [],
  customerInputBoxes: [],
  metaTitle: "",
  metaDescription: "",
  keywords: "",
  canonicalUrl: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  twitterTitle: "",
  twitterDescription: "",
};

export function getProductFormReadiness(form: ProductFormState) {
  const hasTitle = form.title.trim().length > 0;
  const hasCategory = form.categoryIds.length > 0;
  const isActive = form.status === "active";
  return {
    hasTitle,
    hasCategory,
    isActive,
    hasImage:
      form.mediaItems.some((m) => m.url.trim()) ||
      form.variations.some((v) => v.imageUrl.trim()),
    variationCount: form.variations.length,
    readyToPublish: hasTitle && hasCategory && isActive,
  };
}

export function getProductFormSetupHint(form: ProductFormState): string {
  const readiness = getProductFormReadiness(form);
  if (readiness.readyToPublish) {
    return "Ready — product will appear on Shop, home, and the category page after save.";
  }
  if (!readiness.hasTitle) return "Start with the product title in Basic info.";
  if (!readiness.hasCategory) return "Select at least one category in the Catalog sidebar.";
  if (!readiness.isActive) {
    return "Set Status to Active in Publish to show this product on the storefront.";
  }
  return "Complete required fields in the sidebar.";
}

function mediaToItems(
  media?: Array<{ url: string; alt?: string }>,
): ProductImageItem[] {
  return (media ?? []).map((m, i) => ({
    id: `existing-${i}-${m.url}`,
    url: m.url,
    alt: m.alt ?? "",
  }));
}

export function productToFormState(product: AdminProduct): ProductFormState {
  const shortDescription =
    typeof product.attributes?.shortDescription === "string"
      ? product.attributes.shortDescription
      : "";

  return {
    title: product.title ?? "",
    slug: product.slug ?? "",
    sku: product.sku ?? "",
    shortDescription,
    description: product.description ?? "",
    type: product.type,
    deliveryType: (product.deliveryType as "auto" | "manual") ?? "auto",
    status: product.status ?? "draft",
    featured: product.featured ?? false,
    categoryIds:
      product.categoryIds?.length
        ? product.categoryIds
        : product.categoryId
          ? [product.categoryId]
          : [],
    brandId: product.brandId ?? "",
    regions: (product.availableRegions ?? []).join(", "),
    defaultRegion:
      typeof product.attributes?.defaultRegion === "string"
        ? product.attributes.defaultRegion
        : "",
    mediaItems: mediaToItems(product.media),
    showVariationImagesInGallery:
      product.attributes?.showVariationImagesInGallery === true,
    variations: parseStoredVariations(product.attributes),
    customerInputBoxes: parseCustomerInputBoxes(product.attributes),
    metaTitle: product.seo?.metaTitle ?? "",
    metaDescription: product.seo?.metaDescription ?? "",
    keywords: (product.seo?.keywords ?? []).join(", "),
    canonicalUrl: product.seo?.canonicalUrl ?? "",
    ogTitle: product.seo?.ogTitle ?? "",
    ogDescription: product.seo?.ogDescription ?? "",
    ogImage: product.seo?.ogImage ?? "",
    twitterTitle: product.seo?.twitterTitle ?? "",
    twitterDescription: product.seo?.twitterDescription ?? "",
  };
}

export function buildProductPayload(form: ProductFormState): ProductInput {
  const regions = form.regions
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  const media = form.mediaItems
    .filter((m) => m.url.trim())
    .map((m) => ({
      url: m.url.trim(),
      ...(m.alt.trim() ? { alt: m.alt.trim() } : {}),
    }));
  const keywords = form.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const payload: ProductInput = {
    title: form.title.trim(),
    categoryIds: form.categoryIds,
    categoryId: form.categoryIds[0],
    type: form.type,
    deliveryType: form.deliveryType,
    status: form.status,
    featured: form.featured,
    pricing: {
      currency: DEFAULT_PRODUCT_CURRENCY,
      basePrice: getVariationBasePrice(form.variations),
    },
  };
  if (form.slug.trim()) payload.slug = form.slug.trim();
  else {
    const auto = slugify(form.title.trim());
    if (auto) payload.slug = auto;
  }
  if (form.sku.trim()) payload.sku = form.sku.trim();
  payload.description = form.description.trim();
  payload.attributes = {
    shortDescription: form.shortDescription.trim(),
    variations: serializeVariations(form.variations),
    customerInputBoxes: serializeCustomerInputBoxes(form.customerInputBoxes),
    showVariationImagesInGallery: form.showVariationImagesInGallery,
    ...(form.defaultRegion.trim()
      ? { defaultRegion: form.defaultRegion.trim().toUpperCase() }
      : {}),
  };
  if (form.brandId) payload.brandId = form.brandId;
  if (regions.length) payload.availableRegions = regions;
  payload.media = media;
  const seo: NonNullable<ProductInput["seo"]> = {
    metaTitle: form.metaTitle.trim() || undefined,
    metaDescription: form.metaDescription.trim() || undefined,
    keywords: keywords.length ? keywords : undefined,
    canonicalUrl: form.canonicalUrl.trim() || undefined,
    ogTitle: form.ogTitle.trim() || undefined,
    ogDescription: form.ogDescription.trim() || undefined,
    ogImage: form.ogImage.trim() || undefined,
    twitterTitle: form.twitterTitle.trim() || undefined,
    twitterDescription: form.twitterDescription.trim() || undefined,
  };
  if (Object.values(seo).some((v) => v !== undefined)) {
    payload.seo = seo;
  }

  return payload;
}

export function ProductFormActions({
  saving,
  submitLabel,
  savingLabel,
  hint = "Fields marked * are required.",
}: {
  saving: boolean;
  submitLabel: string;
  savingLabel: string;
  /** Contextual helper text shown left of the action buttons. */
  hint?: string;
}) {
  return (
    <div className="admin-product-form-actions dashboard-pro-card admin-order-view-sidebar-card admin-order-view-sidebar-card--pro sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-6">
      <p className="text-xs text-subtle">
        {hint}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? savingLabel : submitLabel}
        </button>
        <Link href="/admin/products" className="dashboard-pro-btn-ghost inline-flex">
          Cancel
        </Link>
      </div>
    </div>
  );
}

export function ProductFormFields({
  form,
  setForm,
  categories,
  brands,
  viewSlug,
  onVariationsPersist,
  onShowPackageImagesPersist,
  onRegionsPersist,
  stockContext,
}: {
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
  categories: Category[];
  brands: Brand[];
  /** When set, shows a public product view link in the right sidebar (edit mode). */
  viewSlug?: string;
  /** Edit mode: save variation changes to the server immediately. */
  onVariationsPersist?: (variations: ProductVariation[]) => Promise<void>;
  /** Edit mode: save package-image gallery setting immediately. */
  onShowPackageImagesPersist?: (value: boolean) => Promise<void>;
  /** Edit mode: save storefront regions immediately. */
  onRegionsPersist?: (payload: {
    availableRegions: string;
    defaultRegion: string;
  }) => Promise<void>;
  /** Edit mode: product inventory counts for variation stock display. */
  stockContext?: ProductStockContext;
}) {
  const catOptions = useMemo(
    () => flattenCategories(categories),
    [categories],
  );

  const checklist = useMemo(() => getProductFormReadiness(form), [form]);
  const readyToPublish = checklist.readyToPublish;
  const summaryPrice = useMemo(
    () => getVariationBasePrice(form.variations),
    [form.variations],
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(viewSlug));

  useEffect(() => {
    setSlugTouched(Boolean(viewSlug));
  }, [viewSlug]);

  const effectiveSlug = slugTouched ? form.slug : slugify(form.title);

  const seoScoreInput = useMemo(
    () => ({
      title: form.title,
      slug: effectiveSlug,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      keywords: form.keywords,
      shortDescription: form.shortDescription,
      description: form.description,
      mediaItems: form.mediaItems,
      categoryIds: form.categoryIds,
      brandId: form.brandId,
      status: form.status,
      variations: form.variations.map((v) => ({
        price: v.price,
        imageUrl: v.imageUrl,
      })),
    }),
    [effectiveSlug, form],
  );

  function set<K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) {
    if (key === "slug") {
      setSlugTouched(true);
      setForm((cur) => ({ ...cur, slug: value as string }));
      return;
    }
    setForm((cur) => ({ ...cur, [key]: value }));
  }

  function toggleCategory(categoryId: string, checked: boolean) {
    setForm((cur) => {
      const next = checked
        ? [...cur.categoryIds, categoryId]
        : cur.categoryIds.filter((id) => id !== categoryId);
      return { ...cur, categoryIds: [...new Set(next)] };
    });
  }

  return (
    <div className="admin-product-form-layout grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="admin-product-form-main admin-order-detail-main min-w-0 space-y-5">
      <ProductFormOrderCard
        className="admin-product-form-section"
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 10h16M4 14h10" />
          </svg>
        }
        title="Basic info"
        subtitle="Product name, URL slug, and internal SKU."
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Product identity</dt>
          <dd className="admin-product-form-basic-fields space-y-4">
          <div>
            <label className={productLabelCls} htmlFor="product-title">
              Title *
            </label>
            <input
              id="product-title"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={productInputCls}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={productLabelCls} htmlFor="product-slug">
                Slug
              </label>
              <input
                id="product-slug"
                value={effectiveSlug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="auto from title"
                className={productInputCls}
              />
            </div>
            <div>
              <label className={productLabelCls} htmlFor="product-sku">
                SKU
              </label>
              <input
                id="product-sku"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                className={productInputCls}
              />
            </div>
          </div>
          </dd>
        </div>
      </ProductFormOrderCard>

      <RichTextSection
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        }
        title="Short description"
        subtitle="Shown below the product image. One line shows first — drag the corner to read the rest."
        fieldLabel="Summary text"
        value={form.shortDescription}
        onChange={(html) => set("shortDescription", html)}
        placeholder="Brief summary about instant delivery, platforms, and key benefits…"
        minHeight={RICH_EDITOR_SINGLE_LINE_PREVIEW_HEIGHT}
        collapsible
      />

      <RichTextSection
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
        }
        title="Product Description"
        subtitle="Shown in the Product Description tab. Unlimited length — write as much as you need."
        fieldLabel="Full description"
        value={form.description}
        onChange={(html) => set("description", html)}
        placeholder="Full product details, features, and how to use…"
        minHeight={RICH_EDITOR_SINGLE_LINE_PREVIEW_HEIGHT}
        unlimitedHeight
        collapsible
      />

      <ProductImageGallery
        items={form.mediaItems}
        productTitle={form.title}
        onChange={(items) =>
          setForm((cur) => ({
            ...cur,
            mediaItems:
              typeof items === "function" ? items(cur.mediaItems) : items,
          }))
        }
      />

      <ProductVariations
        variations={form.variations}
        onChange={(variations) => set("variations", variations)}
        currency={DEFAULT_PRODUCT_CURRENCY}
        availableRegions={form.regions}
        defaultRegion={form.defaultRegion}
        onAvailableRegionsChange={(value) => set("regions", value)}
        onDefaultRegionChange={(value) => set("defaultRegion", value)}
        onRegionsPersist={onRegionsPersist}
        stockContext={stockContext}
        onPersist={onVariationsPersist}
        showPackageImagesInGallery={form.showVariationImagesInGallery}
        onShowPackageImagesInGalleryChange={(value) =>
          set("showVariationImagesInGallery", value)
        }
        onShowPackageImagesPersist={onShowPackageImagesPersist}
        defaultImageUrl={
          form.mediaItems.find((item) => item.url.trim())?.url.trim() ?? ""
        }
      />

      <ProductCustomerInputs
        boxes={form.customerInputBoxes}
        onChange={(boxes) => set("customerInputBoxes", boxes)}
      />
      </div>

      <aside className="admin-product-form-sidebar admin-order-detail-sidebar min-w-0 space-y-5">
      {viewSlug ? (
        <ProductFormOrderCard
          className="admin-product-form-section"
          title="Product view"
          subtitle="Open the live storefront page for this product."
        >
          <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
            <dt>Storefront link</dt>
            <dd className="admin-product-form-sidebar-fields">
              <Link
                href={productPath(viewSlug)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary block w-full text-center"
              >
                View product
              </Link>
            </dd>
          </div>
        </ProductFormOrderCard>
      ) : null}

      <ProductFormOrderCard
        className="admin-product-form-section"
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 15V3m0 12l-4-4m4 4l4-4M5 21h14" />
          </svg>
        }
        title="Publish"
        subtitle="Control storefront visibility and stock state."
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Visibility</dt>
          <dd className="admin-product-form-sidebar-fields space-y-3">
            <div>
              <label className={productLabelCls} htmlFor="product-status">
                Status
              </label>
              <select
                id="product-status"
                value={form.status}
                onChange={(e) => set("status", e.target.value as ProductStatusValue)}
                className="admin-select w-full"
              >
                {PRODUCT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => set("featured", e.target.checked)}
                className="h-4 w-4 rounded border-border accent-amber-400"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Featured product</p>
                <p className="mt-0.5 text-[10px] text-subtle">
                  Show on homepage when "featured only" mode is on
                </p>
              </div>
            </label>
          </dd>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        className="admin-product-form-section"
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        }
        title="Catalog"
        subtitle="Delivery method, category, and brand."
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Classification</dt>
          <dd className="admin-product-form-sidebar-fields space-y-4">
            <div>
              <label className={productLabelCls} htmlFor="product-delivery">
                Delivery
              </label>
              <select
                id="product-delivery"
                value={form.deliveryType}
                onChange={(e) =>
                  set("deliveryType", e.target.value as "auto" | "manual")
                }
                className="admin-select w-full"
              >
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className={productLabelCls.replace("mb-1.5 ", "")}>
                  Categories *
                </span>
                {form.categoryIds.length > 0 ? (
                  <span className="text-[10px] font-medium text-brand">
                    {form.categoryIds.length} selected
                  </span>
                ) : null}
              </div>
              {catOptions.length === 0 ? (
                <p className="text-xs text-subtle">
                  No categories yet.{" "}
                  <Link
                    href="/admin/products/categories"
                    className="font-semibold text-brand underline"
                  >
                    Create categories
                  </Link>
                </p>
              ) : (
                <div
                  id="product-categories"
                  className="admin-product-category-list max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border/50 bg-sunken/40 p-3"
                >
                  {catOptions.map((c) => {
                    const checked = form.categoryIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition ${
                          checked
                            ? "bg-brand/10 text-foreground"
                            : "text-foreground-muted hover:bg-muted/40"
                        }`}
                        style={{ paddingLeft: `${0.5 + c.depth * 0.75}rem` }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleCategory(c.id, e.target.checked)}
                          className="h-4 w-4 rounded border-border-strong bg-muted/50 text-teal-500 focus:ring-teal-500/40"
                        />
                        <span>{c.label.replace(/^—\s*/, "")}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">
                Product appears on each selected category page (
                <code className="text-[10px]">/gift-cards</code>) and in Shop.
                First selected is the primary category. Header menu links are
                managed in{" "}
                <Link
                  href="/admin/settings/menus"
                  className="font-semibold text-brand underline"
                >
                  Header &amp; footer menus
                </Link>
                .
              </p>
            </div>
            <div>
              <label className={productLabelCls} htmlFor="product-brand">
                Brand
              </label>
              <select
                id="product-brand"
                value={form.brandId}
                onChange={(e) => set("brandId", e.target.value)}
                className="admin-select w-full"
              >
                <option value="">None</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </dd>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        className="admin-product-form-section"
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        }
        title="SEO"
        subtitle="Search and social preview metadata."
        action={
          <button
            type="button"
            onClick={() => {
              const title = form.title.trim();
              const desc = (form.shortDescription || form.description)
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              if (title && !form.metaTitle) set("metaTitle", title.slice(0, 60));
              if (desc && !form.metaDescription)
                set("metaDescription", desc.slice(0, 160));
              if (title && !form.keywords)
                set(
                  "keywords",
                  title
                    .split(/\s+/)
                    .filter((w) => w.length > 2)
                    .slice(0, 8)
                    .join(", "),
                );
            }}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Auto-generate
          </button>
        }
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Score</dt>
          <dd>
            <AdminProductSeoScorePanel input={seoScoreInput} />
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Metadata</dt>
          <dd className="admin-product-form-sidebar-fields space-y-4">
            <div>
              <label className={productLabelCls} htmlFor="product-meta-title">
                Meta title
              </label>
              <input
                id="product-meta-title"
                value={form.metaTitle}
                onChange={(e) => set("metaTitle", e.target.value)}
                placeholder="Meta title"
                maxLength={70}
                className={productInputCls}
              />
              <p className="mt-1 text-[11px] text-subtle">
                {form.metaTitle.length}/60 recommended
              </p>
            </div>
            <div>
              <label className={productLabelCls} htmlFor="product-meta-desc">
                Meta description
              </label>
              <textarea
                id="product-meta-desc"
                rows={2}
                value={form.metaDescription}
                onChange={(e) => set("metaDescription", e.target.value)}
                placeholder="Meta description"
                maxLength={180}
                className={productInputCls}
              />
              <p className="mt-1 text-[11px] text-subtle">
                {form.metaDescription.length}/160 recommended
              </p>
            </div>
            <div>
              <label className={productLabelCls} htmlFor="product-keywords">
                Keywords
              </label>
              <input
                id="product-keywords"
                value={form.keywords}
                onChange={(e) => set("keywords", e.target.value)}
                placeholder="Keywords, comma separated"
                className={productInputCls}
              />
            </div>
            <div>
              <label className={productLabelCls} htmlFor="product-canonical">
                Canonical URL
              </label>
              <input
                id="product-canonical"
                value={form.canonicalUrl}
                onChange={(e) => set("canonicalUrl", e.target.value)}
                placeholder="Canonical URL (optional)"
                className={productInputCls}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={productLabelCls} htmlFor="product-og-title">
                  OG title
                </label>
                <input
                  id="product-og-title"
                  value={form.ogTitle}
                  onChange={(e) => set("ogTitle", e.target.value)}
                  placeholder="Open Graph title"
                  className={productInputCls}
                />
              </div>
              <div>
                <label className={productLabelCls} htmlFor="product-og-image">
                  OG image URL
                </label>
                <input
                  id="product-og-image"
                  value={form.ogImage}
                  onChange={(e) => set("ogImage", e.target.value)}
                  placeholder="Open Graph image URL"
                  className={productInputCls}
                />
              </div>
            </div>
            <div>
              <label className={productLabelCls} htmlFor="product-og-desc">
                OG description
              </label>
              <textarea
                id="product-og-desc"
                rows={2}
                value={form.ogDescription}
                onChange={(e) => set("ogDescription", e.target.value)}
                placeholder="Open Graph description"
                className={productInputCls}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={productLabelCls} htmlFor="product-tw-title">
                  Twitter title
                </label>
                <input
                  id="product-tw-title"
                  value={form.twitterTitle}
                  onChange={(e) => set("twitterTitle", e.target.value)}
                  placeholder="Twitter card title"
                  className={productInputCls}
                />
              </div>
              <div>
                <label className={productLabelCls} htmlFor="product-tw-desc">
                  Twitter description
                </label>
                <input
                  id="product-tw-desc"
                  value={form.twitterDescription}
                  onChange={(e) => set("twitterDescription", e.target.value)}
                  placeholder="Twitter card description"
                  className={productInputCls}
                />
              </div>
            </div>
            <AdminSeoSerpPreview
              url={`uniqbd.com/${effectiveSlug || "product-slug"}`}
              title={form.metaTitle || form.title || "Product title"}
              description={form.metaDescription || form.shortDescription}
            />
          </dd>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        className="admin-product-form-section"
        title="Setup checklist"
        subtitle={
          readyToPublish
            ? "Required fields are complete."
            : "Complete required items to publish."
        }
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Readiness</dt>
          <dd className="admin-product-form-sidebar-fields">
            <ul className="space-y-2.5">
              <ChecklistItem done={checklist.hasTitle} label="Product title" />
              <ChecklistItem
                done={checklist.hasCategory}
                label="At least one category selected"
              />
              <ChecklistItem
                done={checklist.isActive}
                label="Status set to Active (storefront visible)"
              />
              <ChecklistItem
                done={checklist.hasImage}
                label="Product image (optional)"
              />
              <ChecklistItem
                done={checklist.variationCount > 0}
                label={
                  checklist.variationCount > 0
                    ? `${checklist.variationCount} variation${checklist.variationCount === 1 ? "" : "s"}`
                    : "Variations (optional)"
                }
              />
            </ul>
          </dd>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        className="admin-product-form-section"
        title="Summary"
        subtitle="Preview of how this product will appear in admin."
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Preview</dt>
          <dd className="admin-product-form-sidebar-fields">
            <div className="admin-order-view-items-customer-box space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={STATUS_STYLE[form.status]}>
                  {STATUS_LABEL[form.status]}
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-foreground">
                {form.title.trim() || "Untitled product"}
              </p>
              <p className="text-xs text-subtle">
                /{effectiveSlug.trim() || "auto-from-title"}
                {form.sku.trim() ? ` · SKU ${form.sku.trim()}` : ""}
              </p>
              <p className="text-lg font-bold text-brand">
                {summaryPrice > 0 ? (
                  <PriceText
                    amount={summaryPrice}
                    currency={DEFAULT_PRODUCT_CURRENCY}
                    className="text-lg font-bold text-brand"
                  />
                ) : (
                  "Set prices in variations"
                )}
              </p>
            </div>
          </dd>
        </div>
      </ProductFormOrderCard>
      </aside>
    </div>
  );
}
