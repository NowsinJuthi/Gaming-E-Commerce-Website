"use client";

import Link from "next/link";
import { PriceText } from "@/components/ui/PriceText";
import { useEffect, useRef, useState } from "react";
import {
  normalizeRegionCode,
  parseRegionInput,
} from "@/components/admin/custom-order-fields-editor";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { uploadProductImage } from "@/lib/api";
import { resolveVariationImageUrl } from "@/lib/product-page";

const inputCls = "admin-input w-full text-foreground placeholder:text-subtle";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";
const IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif";
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type VariationStockType = "giftcard" | "manual" | "api";

export type ProductVariation = {
  id: string;
  name: string;
  valueId: string;
  price: number;
  stockType: VariationStockType;
  imageUrl: string;
  /** Units available when stock type is manual fulfillment. */
  manualStock?: number;
  /** Region codes shown on this package in the storefront (empty = hidden). */
  regions: string[];
};

export const STOCK_TYPE_LABELS: Record<VariationStockType, string> = {
  giftcard: "Gift card codes",
  manual: "Manual Delivery",
  api: "API auto stock",
};

export type ProductStockContext = {
  productId?: string;
  available?: number;
  inventoryAvailable?: number;
  packages?: Array<{
    valueId: string;
    available: number;
    reserved?: number;
    sold?: number;
  }>;
};

function packageInventoryCount(
  variation: ProductVariation,
  ctx?: ProductStockContext,
): number {
  const scoped = ctx?.packages?.find(
    (pkg) => pkg.valueId === variation.valueId,
  );
  if (scoped) return Math.max(0, scoped.available);
  return productInventoryCount(ctx);
}

function productInventoryCount(ctx?: ProductStockContext): number {
  if (!ctx) return 0;
  return Math.max(0, ctx.inventoryAvailable ?? 0, ctx.available ?? 0);
}

function stockManagementHref(productId?: string): string {
  return productId
    ? `/admin/products/stock?productId=${productId}`
    : "/admin/products/stock";
}

function VariationStockCell({
  variation,
  stockContext,
}: {
  variation: ProductVariation;
  stockContext?: ProductStockContext;
}) {
  const inventoryCount = packageInventoryCount(variation, stockContext);
  const stockHref = stockManagementHref(stockContext?.productId);

  if (variation.stockType === "manual") {
    const units = variation.manualStock ?? 0;
    return (
      <span
        className={`text-sm font-semibold ${
          units > 0 ? "text-emerald-300" : "text-amber-300"
        }`}
      >
        {units} units
      </span>
    );
  }

  if (variation.stockType === "giftcard") {
    return (
      <div className="space-y-1">
        {inventoryCount > 0 ? (
          <p className="text-sm font-semibold text-emerald-300">
            {inventoryCount} codes
          </p>
        ) : (
          <p className="text-sm font-semibold text-amber-300">No codes yet</p>
        )}
        <Link
          href={stockHref as any}
          className="text-xs font-semibold text-brand hover:underline"
        >
          Manage codes
        </Link>
      </div>
    );
  }

  if (variation.stockType === "api") {
    return (
      <div className="space-y-1">
        {inventoryCount > 0 ? (
          <p className="text-sm font-semibold text-emerald-300">
            {inventoryCount} units
          </p>
        ) : (
          <p className="text-sm font-semibold text-brand">Supplier API</p>
        )}
        <p className="text-xs text-subtle">Auto-synced stock</p>
      </div>
    );
  }

  return <span className="text-subtle">—</span>;
}

const DEFAULT_STOCK_TYPE: VariationStockType = "manual";

const PACKAGE_PRESETS = [
  "Standard",
  "Premium",
  "Deluxe",
  "1 Month",
  "3 Months",
  "12 Months",
];

type Draft = {
  name: string;
  price: string;
  valueId: string;
  stockType: VariationStockType;
  imageUrl: string;
  manualStock: string;
  regions: string[];
};

function parseListedRegions(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((region) => region.trim())
        .filter(Boolean),
    ),
  ];
}

function regionsMatch(a: string, b: string): boolean {
  return normalizeRegionCode(a) === normalizeRegionCode(b);
}

function ProductVariationsStorefrontRegions({
  availableRegions,
  defaultRegion,
  onCommit,
  saving = false,
}: {
  availableRegions: string;
  defaultRegion: string;
  onCommit: (nextRegions: string, nextDefault: string) => void | Promise<void>;
  saving?: boolean;
}) {
  const [regionDraft, setRegionDraft] = useState("");
  const listedRegions = parseListedRegions(availableRegions);

  function addRegion(code: string) {
    const codes = parseRegionInput(code);
    if (!codes.length) return;
    const next = [...listedRegions];
    for (const entry of codes) {
      if (!next.some((region) => regionsMatch(region, entry))) {
        next.push(entry);
      }
    }
    const nextRegions = next.join(", ");
    let nextDefault = defaultRegion;
    if (
      nextDefault &&
      !next.some((region) => regionsMatch(region, nextDefault))
    ) {
      nextDefault = "";
    }
    void onCommit(nextRegions, nextDefault);
    setRegionDraft("");
  }

  function removeRegion(code: string) {
    const next = listedRegions.filter((region) => !regionsMatch(region, code));
    const nextRegions = next.join(", ");
    let nextDefault = defaultRegion;
    if (
      nextDefault &&
      !next.some((region) => regionsMatch(region, nextDefault))
    ) {
      nextDefault = "";
    }
    void onCommit(nextRegions, nextDefault);
  }

  function submitRegionDraft() {
    addRegion(regionDraft);
  }

  return (
    <div className="admin-product-variations-regions-panel mb-4 rounded-xl border border-border/60 bg-muted/15 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Storefront regions
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-subtle">
            Add regions for the product page dropdown. Set a default region so its
            packages show first. Customers switch regions to see other packages.
          </p>
        </div>
        {saving ? (
          <span className="text-[11px] font-medium text-brand">Saving…</span>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <div>
          <label className={labelCls} htmlFor="variation-storefront-regions">
            Available regions
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="variation-storefront-regions"
              value={regionDraft}
              onChange={(e) => setRegionDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitRegionDraft();
                }
              }}
              onBlur={submitRegionDraft}
              placeholder="e.g. BANGLADESH (BD) or GLOBAL, US"
              className={`${inputCls} min-w-[10rem] flex-1`}
              disabled={saving}
            />
            <button
              type="button"
              onClick={submitRegionDraft}
              disabled={saving}
              className="dashboard-pro-btn-ghost shrink-0 px-3 py-2 text-xs disabled:opacity-50"
            >
              + Add region
            </button>
          </div>
          {listedRegions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {listedRegions.map((region) => (
                <span
                  key={`storefront-${region}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  {region}
                  <button
                    type="button"
                    onClick={() => removeRegion(region)}
                    disabled={saving}
                    className="rounded-full p-0.5 text-subtle transition hover:text-rose-400 disabled:opacity-50"
                    aria-label={`Remove region ${region}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-subtle">
              No storefront regions yet. Add at least one region.
            </p>
          )}
        </div>
        <div>
          <label className={labelCls} htmlFor="variation-default-region">
            Default region
          </label>
          <select
            id="variation-default-region"
            value={defaultRegion}
            onChange={(e) => void onCommit(availableRegions, e.target.value)}
            className="admin-select"
            disabled={listedRegions.length === 0 || saving}
          >
            <option value="">First listed region</option>
            {listedRegions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-subtle">
            This region&apos;s packages load automatically on the product page.
          </p>
        </div>
      </div>
    </div>
  );
}

function VariationRegionsField({
  regions,
  regionDraft,
  onRegionDraftChange,
  onAddRegion,
  onRemoveRegion,
  fieldId,
  suggestedRegions = [],
}: {
  regions: string[];
  regionDraft: string;
  onRegionDraftChange: (value: string) => void;
  onAddRegion: (code: string) => void;
  onRemoveRegion: (code: string) => void;
  fieldId: string;
  suggestedRegions?: string[];
}) {
  function submitRegionDraft() {
    const codes = parseRegionInput(regionDraft);
    if (!codes.length) return;
    for (const code of codes) {
      onAddRegion(code);
    }
    onRegionDraftChange("");
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <label className={labelCls} htmlFor={`variation-regions-${fieldId}`}>
        Regions
      </label>
      <p className="mb-2 text-[11px] text-subtle">
        Tag this package with one or more regions. It only appears when that
        region is selected on the product page.
      </p>
      {suggestedRegions.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestedRegions.map((region) => {
            const active = regions.some((entry) => regionsMatch(entry, region));
            return (
              <button
                key={`${fieldId}-suggest-${region}`}
                type="button"
                onClick={() => onAddRegion(region)}
                disabled={active}
                className="rounded-full border border-border/55 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-brand/35 disabled:cursor-default disabled:opacity-45"
              >
                {active ? `✓ ${region}` : `+ ${region}`}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          id={`variation-regions-${fieldId}`}
          value={regionDraft}
          onChange={(e) => onRegionDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitRegionDraft();
            }
          }}
          onBlur={submitRegionDraft}
          placeholder="e.g. BD or GLOBAL, US"
          className={`${inputCls} min-w-[10rem] flex-1`}
        />
        <button
          type="button"
          onClick={submitRegionDraft}
          className="dashboard-pro-btn-ghost shrink-0 px-3 py-2 text-xs"
        >
          + Add region
        </button>
      </div>
      {regions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {regions.map((region) => (
            <span
              key={`${fieldId}-${region}`}
              className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground"
            >
              {region}
              <button
                type="button"
                onClick={() => onRemoveRegion(region)}
                className="rounded-full p-0.5 text-subtle transition hover:text-rose-400"
                aria-label={`Remove region ${region}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-subtle">No regions on this package.</p>
      )}
    </div>
  );
}

function newId() {
  return `var-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const copy = [...items];
  const current = copy[index];
  const adjacent = copy[nextIndex];
  if (current === undefined || adjacent === undefined) return items;
  copy[index] = adjacent;
  copy[nextIndex] = current;
  return copy;
}

function moveItemToIndex<T>(
  items: T[],
  index: number,
  targetIndex: number,
): T[] {
  if (
    targetIndex < 0 ||
    targetIndex >= items.length ||
    targetIndex === index
  ) {
    return items;
  }
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  if (item === undefined) return items;
  copy.splice(targetIndex, 0, item);
  return copy;
}

function PackageRowActions({
  index,
  total,
  disabled,
  onMoveFirst,
  onMoveUp,
  onMoveDown,
  onMoveLast,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  index: number;
  total: number;
  disabled?: boolean;
  onMoveFirst: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveLast: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;

  return (
    <div className="admin-product-variations-row-actions">
      <div className="admin-product-variations-row-actions-order">
        <button
          type="button"
          disabled={disabled || !canMoveUp}
          onClick={onMoveFirst}
          className="admin-site-menus-icon-btn"
          aria-label="Move to first on product page"
          title="First on product page"
        >
          ⇈
        </button>
        <button
          type="button"
          disabled={disabled || !canMoveUp}
          onClick={onMoveUp}
          className="admin-site-menus-icon-btn"
          aria-label="Move up"
          title="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={disabled || !canMoveDown}
          onClick={onMoveDown}
          className="admin-site-menus-icon-btn"
          aria-label="Move down"
          title="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          disabled={disabled || !canMoveDown}
          onClick={onMoveLast}
          className="admin-site-menus-icon-btn"
          aria-label="Move to last on product page"
          title="Last on product page"
        >
          ⇊
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDuplicate}
          className="admin-site-menus-icon-btn"
          aria-label="Duplicate package"
          title="Duplicate"
        >
          ⧉
        </button>
      </div>
      <div className="admin-product-variations-row-actions-secondary">
        <button
          type="button"
          disabled={disabled}
          onClick={onEdit}
          className="admin-site-menus-icon-btn"
          aria-label="Edit package"
          title="Edit"
        >
          ✎
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          className="admin-site-menus-icon-btn admin-site-menus-icon-btn--danger"
          aria-label="Delete package"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function VariationThumbImage({
  imageUrl,
  defaultImageUrl,
  className = "h-10 w-10 rounded-xl",
}: {
  imageUrl: string;
  defaultImageUrl?: string;
  className?: string;
}) {
  const displayUrl = resolveVariationImageUrl(imageUrl, defaultImageUrl);

  return (
    <div
      className={`admin-product-variation-thumb ${className} shrink-0`}
    >
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-foreground-muted">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
          </svg>
        </div>
      )}
    </div>
  );
}

function VariationMobilePanel({
  variation: v,
  index,
  total,
  currency,
  stockContext,
  disabled,
  onMoveFirst,
  onMoveUp,
  onMoveDown,
  onMoveLast,
  onDuplicate,
  onEdit,
  onDelete,
  defaultImageUrl,
}: {
  variation: ProductVariation;
  index: number;
  total: number;
  currency: string;
  stockContext?: ProductStockContext;
  disabled?: boolean;
  onMoveFirst: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveLast: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  defaultImageUrl?: string;
}) {
  return (
    <div className="admin-product-variations-mobile-detail">
      <div className="admin-product-variations-mobile-package">
        <VariationThumbImage
          imageUrl={v.imageUrl}
          defaultImageUrl={defaultImageUrl}
          className="h-12 w-12 rounded-xl"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">
            Package
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{v.name}</p>
        </div>
      </div>

      <dl className="admin-product-variations-mobile-fields">
        <div className="admin-product-variations-mobile-field">
          <dt>Value ID</dt>
          <dd className="text-foreground-muted">{v.valueId}</dd>
        </div>
        <div className="admin-product-variations-mobile-field">
          <dt>Price</dt>
          <dd className="font-medium text-foreground">
            <PriceText amount={v.price} currency={currency || "BDT"} />
          </dd>
        </div>
        <div className="admin-product-variations-mobile-field">
          <dt>Stock type</dt>
          <dd>
            <span
              className={`dashboard-pro-status ${
                v.stockType === "manual"
                  ? "dashboard-pro-status--brand"
                  : v.stockType === "giftcard"
                    ? "dashboard-pro-status--amber"
                    : "dashboard-pro-status--green"
              }`}
            >
              {STOCK_TYPE_LABELS[v.stockType]}
            </span>
          </dd>
        </div>
        <div className="admin-product-variations-mobile-field">
          <dt>Regions</dt>
          <dd className="text-xs text-foreground-muted">
            {v.regions.length > 0 ? v.regions.join(", ") : "—"}
          </dd>
        </div>
        <div className="admin-product-variations-mobile-field">
          <dt>Stock</dt>
          <dd>
            <VariationStockCell variation={v} stockContext={stockContext} />
          </dd>
        </div>
      </dl>

      <div className="admin-product-variations-mobile-actions">
        <p className="admin-product-variations-mobile-actions-label">
          Order &amp; actions
        </p>
        <PackageRowActions
          index={index}
          total={total}
          disabled={disabled}
          onMoveFirst={onMoveFirst}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onMoveLast={onMoveLast}
          onDuplicate={onDuplicate}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function emptyDraft(nextValueId: string): Draft {
  return {
    name: "",
    price: "",
    valueId: nextValueId,
    stockType: DEFAULT_STOCK_TYPE,
    imageUrl: "",
    manualStock: "0",
    regions: [],
  };
}

function nextValueId(variations: ProductVariation[]): string {
  const nums = variations
    .map((v) => parseInt(v.valueId, 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return String(max + 1);
}

export function parseStoredVariations(
  attrs?: Record<string, unknown>,
): ProductVariation[] {
  const raw = attrs?.variations;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const v = item as Record<string, unknown>;
    const stockType = v.stockType as VariationStockType;
    return {
      id: `stored-${i}`,
      name: String(v.name ?? ""),
      valueId: String(v.valueId ?? ""),
      price: Number(v.price ?? 0),
      stockType:
        stockType && stockType in STOCK_TYPE_LABELS
          ? stockType
          : DEFAULT_STOCK_TYPE,
      imageUrl: v.imageUrl ? String(v.imageUrl) : "",
      manualStock: Math.max(0, Number(v.manualStock ?? 0)),
      regions: Array.isArray(v.regions)
        ? [
            ...new Set(
              v.regions
                .map((region) => normalizeRegionCode(String(region)))
                .filter(Boolean),
            ),
          ]
        : [],
    };
  });
}

export function resolveVariationRegions(
  attrs: Record<string, unknown> | undefined,
  variationValueId?: string,
  productRegions?: string[],
): string[] {
  const normalizedId = variationValueId?.trim();
  if (normalizedId) {
    const variation = parseStoredVariations(attrs).find(
      (row) => row.valueId === normalizedId,
    );
    if (variation?.regions.length) {
      return variation.regions;
    }
  }
  return (productRegions ?? [])
    .map((region) => normalizeRegionCode(region))
    .filter(Boolean);
}

export function serializeVariations(variations: ProductVariation[]) {
  return variations.map((v) => ({
    name: v.name.trim(),
    valueId: v.valueId.trim(),
    price: v.price,
    stockType: v.stockType,
    ...(v.imageUrl.trim() ? { imageUrl: v.imageUrl.trim() } : {}),
    ...(v.regions.length
      ? { regions: v.regions.map(normalizeRegionCode).filter(Boolean) }
      : {}),
    ...(v.stockType === "manual"
      ? { manualStock: Math.max(0, v.manualStock ?? 0) }
      : {}),
  }));
}

type ProductVariationsProps = {
  variations: ProductVariation[];
  onChange: (variations: ProductVariation[]) => void;
  currency: string;
  availableRegions?: string;
  defaultRegion?: string;
  onAvailableRegionsChange?: (value: string) => void;
  onDefaultRegionChange?: (value: string) => void;
  onRegionsPersist?: (payload: {
    availableRegions: string;
    defaultRegion: string;
  }) => Promise<void>;
  /** Product-level inventory for gift card / API package stock display. */
  stockContext?: ProductStockContext;
  /** When set (edit product), packages are saved to the server immediately. */
  onPersist?: (variations: ProductVariation[]) => Promise<void>;
  showPackageImagesInGallery?: boolean;
  onShowPackageImagesInGalleryChange?: (value: boolean) => void;
  onShowPackageImagesPersist?: (value: boolean) => Promise<void>;
  /** Product gallery image when a package has no image. */
  defaultImageUrl?: string;
};

export function ProductVariations({
  variations,
  onChange,
  currency,
  availableRegions = "",
  defaultRegion = "",
  onAvailableRegionsChange,
  onDefaultRegionChange,
  onRegionsPersist,
  stockContext,
  onPersist,
  showPackageImagesInGallery = false,
  onShowPackageImagesInGalleryChange,
  onShowPackageImagesPersist,
  defaultImageUrl = "",
}: ProductVariationsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft("1"));
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [persistBusy, setPersistBusy] = useState(false);
  const [regionsPersistBusy, setRegionsPersistBusy] = useState(false);
  const [regionDraft, setRegionDraft] = useState("");
  const [mobileSelectedId, setMobileSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (variations.length === 0) {
      setMobileSelectedId(null);
      return;
    }
    if (
      !mobileSelectedId ||
      !variations.some((v) => v.id === mobileSelectedId)
    ) {
      setMobileSelectedId(variations[0]?.id ?? null);
    }
  }, [variations, mobileSelectedId]);

  const mobileSelectedIndex = variations.findIndex(
    (v) => v.id === mobileSelectedId,
  );
  const mobileSelectedVariation =
    mobileSelectedIndex >= 0 ? variations[mobileSelectedIndex] : variations[0];
  const mobileActiveIndex =
    mobileSelectedIndex >= 0 ? mobileSelectedIndex : 0;
  const listedRegions = parseListedRegions(availableRegions);

  function mergeDraftRegions(): string[] {
    const pending = parseRegionInput(regionDraft).filter(
      (code) => !draft.regions.includes(code),
    );
    return pending.length ? [...draft.regions, ...pending] : draft.regions;
  }

  function addDraftRegion(code: string) {
    const normalized = normalizeRegionCode(code);
    if (!normalized || draft.regions.includes(normalized)) return;
    setDraft((current) => ({
      ...current,
      regions: [...current.regions, normalized],
    }));
  }

  function removeDraftRegion(code: string) {
    setDraft((current) => ({
      ...current,
      regions: current.regions.filter((region) => region !== code),
    }));
  }

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft(nextValueId(variations)));
    setDraftError(null);
    setShowUrlInput(false);
    setRegionDraft("");
    setEditorOpen(true);
  }

  function openEdit(id: string) {
    const v = variations.find((x) => x.id === id);
    if (!v) return;
    setEditingId(id);
    setDraft({
      name: v.name,
      price: String(v.price),
      valueId: v.valueId,
      stockType: v.stockType,
      imageUrl: v.imageUrl,
      manualStock: String(v.manualStock ?? 0),
      regions: [...v.regions],
    });
    setDraftError(null);
    setShowUrlInput(!!v.imageUrl);
    setRegionDraft("");
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setDraftError(null);
    setRegionDraft("");
  }

  function refreshValueId() {
    setDraft((d) => ({ ...d, valueId: nextValueId(variations) }));
  }

  async function commitRegions(nextRegions: string, nextDefault: string) {
    if (!onAvailableRegionsChange || !onDefaultRegionChange) return;

    setPersistError(null);
    const previousRegions = availableRegions;
    const previousDefault = defaultRegion;
    onAvailableRegionsChange(nextRegions);
    onDefaultRegionChange(nextDefault);
    if (!onRegionsPersist) return;

    setRegionsPersistBusy(true);
    try {
      await onRegionsPersist({
        availableRegions: nextRegions,
        defaultRegion: nextDefault,
      });
    } catch (err) {
      onAvailableRegionsChange(previousRegions);
      onDefaultRegionChange(previousDefault);
      setPersistError(
        err instanceof Error ? err.message : "Could not save storefront regions",
      );
    } finally {
      setRegionsPersistBusy(false);
    }
  }

  async function commitVariations(nextVariations: ProductVariation[]) {
    setPersistError(null);
    const previous = variations;
    onChange(nextVariations);
    if (!onPersist) return;

    setPersistBusy(true);
    try {
      await onPersist(nextVariations);
    } catch (err) {
      onChange(previous);
      setPersistError(
        err instanceof Error ? err.message : "Could not save packages",
      );
    } finally {
      setPersistBusy(false);
    }
  }

  function moveVariation(
    index: number,
    target: "first" | "up" | "down" | "last",
  ) {
    let next = variations;
    if (target === "first") {
      next = moveItemToIndex(variations, index, 0);
    } else if (target === "last") {
      next = moveItemToIndex(variations, index, variations.length - 1);
    } else if (target === "up") {
      next = moveItem(variations, index, -1);
    } else {
      next = moveItem(variations, index, 1);
    }
    if (next === variations) return;
    void commitVariations(next);
  }

  function duplicateVariation(id: string) {
    const index = variations.findIndex((v) => v.id === id);
    if (index < 0) return;
    const source = variations[index]!;
    const copy: ProductVariation = {
      ...source,
      id: newId(),
      name: source.name.trim() ? `${source.name.trim()} (copy)` : "Copy",
      valueId: nextValueId(variations),
      regions: [...source.regions],
    };
    const next = [...variations];
    next.splice(index + 1, 0, copy);
    void commitVariations(next);
  }

  async function savePackage() {
    setDraftError(null);
    setPersistError(null);
    const name = draft.name.trim();
    const price = Number(draft.price);
    const valueId = draft.valueId.trim();

    if (!name) {
      setDraftError("Package name is required.");
      return;
    }
    if (!valueId) {
      setDraftError("Value ID is required.");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setDraftError("Enter a valid price.");
      return;
    }
    const duplicate = variations.some(
      (v) => v.valueId === valueId && v.id !== editingId,
    );
    if (duplicate) {
      setDraftError("Value ID must be unique.");
      return;
    }

    const manualStock =
      draft.stockType === "manual"
        ? Math.max(0, Number(draft.manualStock) || 0)
        : undefined;
    const regions = mergeDraftRegions();
    setRegionDraft("");

    const entry: ProductVariation = {
      id: editingId ?? newId(),
      name,
      valueId,
      price,
      stockType: draft.stockType,
      imageUrl: draft.imageUrl.trim(),
      manualStock,
      regions,
    };

    const nextVariations = editingId
      ? variations.map((v) => (v.id === editingId ? entry : v))
      : [...variations, entry];

    onChange(nextVariations);

    if (onPersist) {
      setPersistBusy(true);
      try {
        await onPersist(nextVariations);
        closeEditor();
      } catch (err) {
        onChange(variations);
        setDraftError(
          err instanceof Error ? err.message : "Could not save package",
        );
      } finally {
        setPersistBusy(false);
      }
      return;
    }

    closeEditor();
  }

  async function remove(id: string) {
    setPersistError(null);
    const nextVariations = variations.filter((v) => v.id !== id);
    onChange(nextVariations);
    if (editingId === id) closeEditor();

    if (!onPersist) return;

    setPersistBusy(true);
    try {
      await onPersist(nextVariations);
    } catch (err) {
      onChange(variations);
      setPersistError(
        err instanceof Error ? err.message : "Could not remove package",
      );
    } finally {
      setPersistBusy(false);
    }
  }

  async function handleShowPackageImagesChange(checked: boolean) {
    if (!onShowPackageImagesInGalleryChange) return;
    onShowPackageImagesInGalleryChange(checked);
    if (!onShowPackageImagesPersist) return;

    setPersistError(null);
    setPersistBusy(true);
    try {
      await onShowPackageImagesPersist(checked);
    } catch (err) {
      onShowPackageImagesInGalleryChange(!checked);
      setPersistError(
        err instanceof Error ? err.message : "Could not save gallery setting",
      );
    } finally {
      setPersistBusy(false);
    }
  }

  async function onFileSelect(file: File | undefined) {
    if (!file) return;
    setDraftError(null);
    if (!file.type.startsWith("image/")) {
      setDraftError("Please choose an image file.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setDraftError("Image must be 10 MB or smaller.");
      return;
    }
    setUploadBusy(true);
    try {
      const result = await uploadProductImage(file);
      setDraft((d) => ({ ...d, imageUrl: result.url }));
      setShowUrlInput(true);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <ProductFormOrderCard
      className="admin-product-form-section admin-product-variations-card"
      icon={
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 7h16M4 12h10M4 17h14" />
          <circle cx="18" cy="12" r="2" />
        </svg>
      }
      title="Variations"
      subtitle={
        onPersist
          ? "Set storefront regions, tag each package with a region, and reorder packages. Saves automatically when editing."
          : "Set regions and add packages — saved when you create the product."
      }
      action={
        <div className="admin-product-variations-head-actions">
          {onShowPackageImagesInGalleryChange ? (
            <label className="admin-product-variations-gallery-toggle">
              <input
                type="checkbox"
                checked={showPackageImagesInGallery}
                disabled={persistBusy}
                onChange={(e) =>
                  void handleShowPackageImagesChange(e.target.checked)
                }
                className="rounded border-border text-brand focus:ring-brand/30 disabled:opacity-50"
              />
              <span>Show package images from variations</span>
            </label>
          ) : null}
          <button
            type="button"
            onClick={openAdd}
            disabled={persistBusy}
            className="btn-primary admin-product-variations-add-btn disabled:opacity-50"
          >
            + Add variation
          </button>
        </div>
      }
    >
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Packages</dt>
        <dd className="admin-product-form-variation-fields space-y-4">
      {onAvailableRegionsChange && onDefaultRegionChange ? (
        <ProductVariationsStorefrontRegions
          availableRegions={availableRegions}
          defaultRegion={defaultRegion}
          onCommit={commitRegions}
          saving={regionsPersistBusy}
        />
      ) : null}
      {persistError ? (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {persistError}
        </div>
      ) : null}

      {variations.length > 0 ? (
        <>
          <div className="admin-product-variations-mobile lg:hidden mb-4">
            <div className="admin-product-variations-tabs-outer">
              <div
                className="admin-order-status-tabs-bar admin-order-status-tabs-bar--slider admin-product-variations-tabs-bar"
                role="tablist"
                aria-label="Product packages"
              >
                {variations.map((v, i) => (
                  <span key={v.id} className="admin-order-status-tabs-item">
                    {i > 0 ? (
                      <span
                        className="mx-1.5 text-border-strong sm:mx-2"
                        aria-hidden
                      >
                        |
                      </span>
                    ) : null}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mobileSelectedId === v.id}
                      onClick={() => setMobileSelectedId(v.id)}
                      className={`admin-order-status-tab-btn ${
                        mobileSelectedId === v.id
                          ? "admin-order-status-tab-btn--active"
                          : ""
                      }`}
                    >
                      <span className="admin-order-status-tab-label">
                        {v.name.trim() || `Package ${i + 1}`}
                      </span>
                      <span
                        className={`admin-order-status-tab-count ${
                          mobileSelectedId === v.id
                            ? "admin-order-status-tab-count--active"
                            : ""
                        }`}
                      >
                        {v.valueId}
                      </span>
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {mobileSelectedVariation ? (
              <VariationMobilePanel
                variation={mobileSelectedVariation}
                index={mobileActiveIndex}
                total={variations.length}
                currency={currency}
                stockContext={stockContext}
                disabled={persistBusy}
                onMoveFirst={() =>
                  moveVariation(mobileActiveIndex, "first")
                }
                onMoveUp={() => moveVariation(mobileActiveIndex, "up")}
                onMoveDown={() => moveVariation(mobileActiveIndex, "down")}
                onMoveLast={() => moveVariation(mobileActiveIndex, "last")}
                onDuplicate={() =>
                  duplicateVariation(mobileSelectedVariation.id)
                }
                onEdit={() => openEdit(mobileSelectedVariation.id)}
                onDelete={() => void remove(mobileSelectedVariation.id)}
                defaultImageUrl={defaultImageUrl}
              />
            ) : null}
          </div>

          <div
            className="admin-product-variations-table-wrap panel-3d-table-wrap mb-4 hidden overflow-x-auto lg:block"
          >
          <table className="panel-3d-table panel-3d-table--variations">
            <thead>
              <tr>
                <th>Package</th>
                <th>Value ID</th>
                <th>Price</th>
                <th>Stock type</th>
                <th>Regions</th>
                <th>Stock</th>
                <th className="text-right">Order &amp; actions</th>
              </tr>
            </thead>
            <tbody>
              {variations.map((v, index) => (
                <tr key={v.id}>
                  <td data-label="Package">
                    <div className="flex items-center gap-3">
                      <VariationThumbImage
                        imageUrl={v.imageUrl}
                        defaultImageUrl={defaultImageUrl}
                      />
                      <span className="font-medium text-foreground">{v.name}</span>
                    </div>
                  </td>
                  <td data-label="Value ID" className="text-foreground-muted">
                    {v.valueId}
                  </td>
                  <td data-label="Price" className="font-medium text-foreground">
                    <PriceText amount={v.price} currency={currency || "BDT"} />
                  </td>
                  <td data-label="Stock type">
                    <span
                      className={`dashboard-pro-status ${
                        v.stockType === "manual"
                          ? "dashboard-pro-status--brand"
                          : v.stockType === "giftcard"
                            ? "dashboard-pro-status--amber"
                            : "dashboard-pro-status--green"
                      }`}
                    >
                      {STOCK_TYPE_LABELS[v.stockType]}
                    </span>
                  </td>
                  <td data-label="Regions" className="text-xs text-foreground-muted">
                    {v.regions.length > 0 ? v.regions.join(", ") : "—"}
                  </td>
                  <td data-label="Stock">
                    <VariationStockCell
                      variation={v}
                      stockContext={stockContext}
                    />
                  </td>
                  <td data-label="Order & actions" className="text-right">
                    <PackageRowActions
                      index={index}
                      total={variations.length}
                      disabled={persistBusy}
                      onMoveFirst={() => moveVariation(index, "first")}
                      onMoveUp={() => moveVariation(index, "up")}
                      onMoveDown={() => moveVariation(index, "down")}
                      onMoveLast={() => moveVariation(index, "last")}
                      onDuplicate={() => duplicateVariation(v.id)}
                      onEdit={() => openEdit(v.id)}
                      onDelete={() => void remove(v.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mb-4 text-sm text-subtle">
          No packages yet. Click <strong className="text-foreground-muted">Add variation</strong>,
          fill in the details, then click{" "}
          <strong className="text-foreground-muted">Add package</strong> to list it here.
        </p>
      )}

      {editorOpen && (
        <div
          className="admin-product-variations-editor admin-product-form-subpanel rounded-xl border border-border bg-sunken p-4 sm:p-5"
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              (e.target as HTMLElement).tagName !== "TEXTAREA"
            ) {
              e.preventDefault();
            }
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-teal-400">✎</span>
              <h4 className="text-sm font-semibold text-foreground">
                {editingId ? "Edit package" : "Add package"}
              </h4>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              className="text-foreground-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>

          {draftError && (
            <div className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {draftError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Select package name</label>
              <input
                list="package-presets"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="e.g. Premium"
                className={inputCls}
              />
              <datalist id="package-presets">
                {PACKAGE_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={draft.price}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, price: e.target.value }))
                }
                placeholder="e.g. 100"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Value ID</label>
              <div className="flex gap-2">
                <input
                  value={draft.valueId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, valueId: e.target.value }))
                  }
                  placeholder="Unique number"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={refreshValueId}
                  className="dashboard-pro-btn-ghost shrink-0 px-3 text-xs"
                  title="Refresh label"
                >
                  ↻
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border p-4">
            <label className={labelCls}>Stock type</label>
            <select
              value={draft.stockType}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  stockType: e.target.value as VariationStockType,
                }))
              }
              className="admin-select mt-1 w-full max-w-xs"
            >
              {(Object.keys(STOCK_TYPE_LABELS) as VariationStockType[]).map(
                (k) => (
                  <option key={k} value={k}>
                    {STOCK_TYPE_LABELS[k]}
                  </option>
                ),
              )}
            </select>
            <p className="mt-2 text-xs text-subtle">
              {draft.stockType === "giftcard"
                ? "Import codes in Stock management. Orders auto-deliver codes after payment."
                : draft.stockType === "manual"
                  ? "You deliver orders manually after payment."
                  : "Stock synced automatically via supplier API."}
            </p>
            {draft.stockType === "giftcard" && (
              <p className="mt-1 text-xs text-subtle">
                Import gift card codes for this variation in{" "}
                <Link
                  href={stockManagementHref(stockContext?.productId) as any}
                  className="text-teal-400 hover:underline"
                >
                  Admin → Stock management
                </Link>
              </p>
            )}
            {draft.stockType === "api" && (
              <p className="mt-1 text-xs text-subtle">
                {productInventoryCount(stockContext) > 0
                  ? `${productInventoryCount(stockContext)} units available from product inventory. Additional stock can sync from your supplier API.`
                  : "Stock is fulfilled automatically through your connected supplier API."}
              </p>
            )}
            {draft.stockType === "manual" && (
              <div className="mt-4 border-t border-border pt-4">
                <label className={labelCls} htmlFor="manual-stock">
                  Stock
                </label>
                <input
                  id="manual-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.manualStock}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, manualStock: e.target.value }))
                  }
                  placeholder="e.g. 10"
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-subtle">
                  Units available for sale. You deliver orders manually after
                  payment.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-border p-4">
            <VariationRegionsField
              fieldId={draft.valueId || "new"}
              regions={draft.regions}
              regionDraft={regionDraft}
              onRegionDraftChange={setRegionDraft}
              onAddRegion={addDraftRegion}
              onRemoveRegion={removeDraftRegion}
              suggestedRegions={listedRegions}
            />
          </div>

          <div className="mt-4 rounded-lg border border-border p-4">
            <label className={labelCls}>Package image</label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <VariationThumbImage
                imageUrl={draft.imageUrl}
                defaultImageUrl={defaultImageUrl}
                className="h-14 w-14 rounded-lg"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadBusy}
                className="dashboard-pro-btn-ghost disabled:opacity-50"
              >
                {uploadBusy ? "Uploading…" : "Upload"}
              </button>
              <button
                type="button"
                onClick={() => setShowUrlInput((s) => !s)}
                className="text-sm text-teal-400 hover:underline"
              >
                Image URL (optional)
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => void onFileSelect(e.target.files?.[0])}
              />
            </div>
            {showUrlInput && (
              <input
                value={draft.imageUrl}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, imageUrl: e.target.value }))
                }
                placeholder="https://example.com/variation.jpg"
                className={`${inputCls} mt-3`}
              />
            )}
            <p className="mt-2 text-xs text-subtle">
              Upload JPG, PNG, WebP, GIF, or AVIF (max 10 MB), or paste a hosted
              URL. If empty, the product&apos;s main image is shown on the
              storefront.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void savePackage()}
              disabled={persistBusy || uploadBusy}
              className="btn-primary disabled:opacity-50"
            >
              {persistBusy
                ? "Saving…"
                : editingId
                  ? "Save package"
                  : "Add package"}
            </button>
            <button
              type="button"
              onClick={closeEditor}
              disabled={persistBusy}
              className="dashboard-pro-btn-ghost text-rose-400 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
        </dd>
      </div>
    </ProductFormOrderCard>
  );
}
