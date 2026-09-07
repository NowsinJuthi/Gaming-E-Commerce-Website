"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { BannerUploadField } from "@/components/admin/BannerUploadField";
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  ImageAttachIcon,
  LayersIcon,
  TrashIcon,
} from "@/components/admin/icons";
import {
  getCustomerPanelAdminSettings,
  revalidateStorefrontHomepage,
  updateCustomerPanelSettings,
  type HomepageSlide,
} from "@/lib/api";
import { invalidatePanelConfig } from "@/lib/customer-panel";
import { resolveMediaSrc } from "@/lib/site-appearance";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

const HOMEPAGE_SLIDE_BANNER_SIZE = "1600×400 px";
const HOMEPAGE_SLIDE_BANNER_RATIO = "4:1 wide";
const HOMEPAGE_SLIDE_BANNER_SIZE_HINT = `${HOMEPAGE_SLIDE_BANNER_SIZE} (${HOMEPAGE_SLIDE_BANNER_RATIO})`;

type EditableSlide = HomepageSlide & { id: string };
type SlideStatus = "live" | "hidden" | "draft";

function newId() {
  return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptySlide(sortOrder: number): EditableSlide {
  return {
    id: newId(),
    imageUrl: "",
    alt: "",
    href: "",
    enabled: true,
    sortOrder,
  };
}

function toEditable(slides: HomepageSlide[]): EditableSlide[] {
  return slides.map((slide, index) => ({
    ...slide,
    id: newId(),
    sortOrder: slide.sortOrder ?? index,
  }));
}

function fromEditable(slides: EditableSlide[]): HomepageSlide[] {
  return slides
    .filter((slide) => slide.imageUrl.trim())
    .map((slide, index) => ({
      imageUrl: slide.imageUrl.trim(),
      alt: slide.alt.trim(),
      href: slide.href.trim(),
      enabled: slide.enabled,
      sortOrder: index,
    }));
}

function serializePayload(slides: EditableSlide[]) {
  return JSON.stringify(fromEditable(slides));
}

function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item!);
  return copy;
}

function getSlideStatus(slide: EditableSlide): SlideStatus {
  if (!slide.enabled) return "hidden";
  if (!slide.imageUrl.trim()) return "draft";
  return "live";
}

const STATUS_LABEL: Record<SlideStatus, string> = {
  live: "Live",
  hidden: "Hidden",
  draft: "Needs image",
};

function loadingStat(ready: boolean, value: string) {
  return ready ? value : "…";
}

function overviewStatClass(tone: "brand" | "success" | "amber" | "muted") {
  return [
    "customer-dashboard-overview-stat",
    `customer-dashboard-overview-stat--${tone}`,
    "cursor-default",
  ].join(" ");
}

function SliderOverviewStatCopy({
  label,
  value,
  meta,
}: {
  label: string;
  value: string | number;
  meta: string;
}) {
  return (
    <div className="customer-dashboard-overview-stat-copy min-w-0">
      <span className="customer-dashboard-overview-stat-label">{label}</span>
      <span className="customer-dashboard-overview-stat-value">{value}</span>
      <p className="customer-dashboard-overview-stat-meta">{meta}</p>
    </div>
  );
}

const Field = memo(function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-subtle">{hint}</p> : null}
    </div>
  );
});

const SlideStatusBadge = memo(function SlideStatusBadge({
  status,
}: {
  status: SlideStatus;
}) {
  return (
    <span className={`admin-homepage-slider-badge admin-homepage-slider-badge--${status}`}>
      {STATUS_LABEL[status]}
    </span>
  );
});

const SlideBannerImage = memo(function SlideBannerImage({
  src,
  alt,
  frameClassName = "rounded-xl",
}: {
  src: string;
  alt: string;
  frameClassName?: string;
}) {
  return (
    <div
      className={`admin-homepage-slider-banner-frame relative aspect-[4/1] overflow-hidden border border-border/60 bg-[#01131a] ${frameClassName}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- full-res admin banner preview */}
      <img
        src={resolveMediaSrc(src)}
        alt={alt}
        className="admin-homepage-slider-banner-img"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
});

export function HomepageSliderSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slides, setSlides] = useState<EditableSlide[]>([]);
  const [savedPayload, setSavedPayload] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [savedFeaturedOnly, setSavedFeaturedOnly] = useState(false);
  const [savingFeatured, setSavingFeatured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getCustomerPanelAdminSettings();
        if (cancelled) return;
        const incoming = (data.homepageSlides ?? []) as HomepageSlide[];
        const editable = toEditable(incoming);
        setSlides(editable);
        setSavedPayload(serializePayload(editable));
        setFeaturedOnly(data.homepageFeaturedOnly ?? false);
        setSavedFeaturedOnly(data.homepageFeaturedOnly ?? false);
      } catch (err) {
        adminToast(
          err instanceof Error ? err.message : "Failed to load homepage slider",
          false,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveFeaturedOnly(value: boolean) {
    setSavingFeatured(true);
    try {
      await updateCustomerPanelSettings({ homepageFeaturedOnly: value });
      invalidatePanelConfig();
      await revalidateStorefrontHomepage();
      setFeaturedOnly(value);
      setSavedFeaturedOnly(value);
      adminToast(
        value
          ? "Homepage will now show only featured products."
          : "Homepage will show all active products.",
        true,
      );
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to update homepage setting",
        false,
      );
      setFeaturedOnly(savedFeaturedOnly);
    } finally {
      setSavingFeatured(false);
    }
  }

  const stats = useMemo(() => {
    const live = slides.filter(
      (slide) => slide.enabled && slide.imageUrl.trim(),
    ).length;
    const draft = slides.filter(
      (slide) => slide.enabled && !slide.imageUrl.trim(),
    ).length;
    return {
      total: slides.length,
      live,
      hidden: slides.length - live - draft,
      draft,
    };
  }, [slides]);

  const isDirty = useMemo(
    () => !loading && serializePayload(slides) !== savedPayload,
    [loading, slides, savedPayload],
  );

  const updateSlide = useCallback((id: string, patch: Partial<EditableSlide>) => {
    setSlides((current) =>
      current.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
    );
  }, []);

  const addSlides = useCallback((count = 2) => {
    const safeCount = Math.max(1, count);
    setSlides((current) => {
      const next = [...current];
      for (let i = 0; i < safeCount; i += 1) {
        next.push(emptySlide(next.length));
      }
      return next;
    });
  }, []);

  const duplicateSlide = useCallback((slide: EditableSlide) => {
    setSlides((current) => {
      const index = current.findIndex((row) => row.id === slide.id);
      const copy: EditableSlide = {
        ...slide,
        id: newId(),
        enabled: false,
        sortOrder: current.length,
      };
      if (index === -1) return [...current, copy];
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }, []);

  const removeSlide = useCallback((id: string) => {
    setSlides((current) => current.filter((row) => row.id !== id));
  }, []);

  async function handleSave() {
    const payload = fromEditable(slides);
    const enabledWithoutImage = slides.some(
      (slide) => slide.enabled && !slide.imageUrl.trim(),
    );
    if (enabledWithoutImage) {
      adminToast(
        "Some enabled slides are missing an image. Upload a banner or disable those slides.",
        false,
      );
      return;
    }

    setSaving(true);
    hideAdminToast();
    try {
      await updateCustomerPanelSettings({ homepageSlides: payload });
      invalidatePanelConfig();
      await revalidateStorefrontHomepage();
      setSavedPayload(serializePayload(slides));
      adminToast("Homepage slider published to the storefront.", true);
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to save homepage slider",
        false,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-homepage-slider-page space-y-5">
      {/* Homepage product display mode */}
      <AdminOrderListCard
        icon={<EyeIcon className="h-4 w-4" />}
        title="Homepage product display"
        subtitle="Control which products appear in homepage category sections"
        className="admin-homepage-slider-catalog"
        flatBody
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            By default, all active products appear in the homepage sections (newest first). Enable
            <strong className="text-foreground"> Featured Only</strong> mode to show only products
            you have manually marked as &ldquo;Featured&rdquo; in their product settings.
          </p>
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${featuredOnly ? "border-amber-500/40 bg-amber-500/10" : "border-border/50 bg-muted/20 hover:bg-muted/40"}`}>
            <input
              type="checkbox"
              checked={featuredOnly}
              disabled={loading || savingFeatured}
              onChange={(e) => void handleSaveFeaturedOnly(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-amber-400 disabled:opacity-50"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Show only featured products on homepage
                {featuredOnly ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                    Active
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-subtle">
                When enabled, only products with the &ldquo;Featured product&rdquo; checkbox ticked will show on the
                homepage. Mark products as featured from{" "}
                <Link href="/admin/products" className="text-brand underline">
                  Products → Edit → Publish
                </Link>
                .
              </p>
            </div>
          </label>
          {savingFeatured ? (
            <p className="text-xs text-subtle">Saving…</p>
          ) : null}
        </div>
      </AdminOrderListCard>

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<ImageAttachIcon className="h-4 w-4" />}
              title="Slider overview"
              subtitle="Hero banner carousel at a glance"
              className="admin-homepage-slider-catalog"
              flatBody
            >
              <section
                className="customer-dashboard-overview-section admin-homepage-slider-overview"
                aria-label="Slider overview"
              >
                <div className="customer-dashboard-overview-stats">
                  <div className={overviewStatClass("brand")}>
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <LayersIcon className="h-4 w-4" />
                    </span>
                    <SliderOverviewStatCopy
                      label="Total slides"
                      value={loadingStat(!loading, String(stats.total))}
                      meta="Configured in admin"
                    />
                  </div>

                  <div className={overviewStatClass("success")}>
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <SliderOverviewStatCopy
                      label="Live on homepage"
                      value={loadingStat(!loading, String(stats.live))}
                      meta="Enabled with banner image"
                    />
                  </div>

                  <div className={overviewStatClass("amber")}>
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <ImageAttachIcon className="h-4 w-4" />
                    </span>
                    <SliderOverviewStatCopy
                      label="Needs image"
                      value={loadingStat(!loading, String(stats.draft))}
                      meta="Enabled but missing banner"
                    />
                  </div>

                  <div className={overviewStatClass("muted")}>
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <EyeIcon className="h-4 w-4" />
                    </span>
                    <SliderOverviewStatCopy
                      label="Hidden"
                      value={loadingStat(!loading, String(stats.hidden))}
                      meta="Disabled on storefront"
                    />
                  </div>
                </div>
              </section>
            </AdminOrderListCard>

            <div className="admin-homepage-slider-slides">
              {loading ? (
                <AdminOrderListCard
                  title="Loading slides"
                  subtitle="Fetching homepage slider configuration"
                  flatBody
                >
                  <p className="text-sm text-subtle">Please wait…</p>
                </AdminOrderListCard>
              ) : slides.length === 0 ? (
                <AdminOrderListCard
                  title="No slides yet"
                  subtitle="Create your first homepage hero banner"
                  flatBody
                >
                  <div className="admin-homepage-slider-empty">
                    <p className="text-sm text-foreground-muted">
                      Promote offers, gift cards, or featured games with a wide banner
                      carousel at the top of your storefront.
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-subtle">
                      <li>Recommended size: 1600×400 px (4:1 wide ratio)</li>
                      <li>Slides rotate automatically on the homepage</li>
                      <li>Optionally link each banner to a product or category</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => addSlides(2)}
                      className="btn-primary mt-5"
                    >
                      Add 2 slides
                    </button>
                  </div>
                </AdminOrderListCard>
              ) : (
                <>
                  <div className="admin-homepage-slider-slides-grid">
                    {slides.map((slide, index) => {
                  const status = getSlideStatus(slide);
                  return (
                    <article
                      key={slide.id}
                      className="admin-logos-slot admin-homepage-slider-slide"
                    >
                      <div className="admin-homepage-slider-slide-head">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">
                              Slide {index + 1}
                            </h3>
                            <SlideStatusBadge status={status} />
                          </div>
                          <p className="mt-0.5 text-[11px] text-subtle">
                            Upload size:{" "}
                            <span className="font-medium text-foreground-muted">
                              {HOMEPAGE_SLIDE_BANNER_SIZE_HINT}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-subtle">
                            {slide.alt.trim() || "No alt text yet"}
                          </p>
                        </div>
                        <div className="admin-homepage-slider-slide-tools">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() =>
                              setSlides((current) => moveItem(current, index, -1))
                            }
                            className="dashboard-pro-btn-ghost px-2 py-1 text-[11px] disabled:opacity-40"
                            aria-label={`Move slide ${index + 1} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={index === slides.length - 1}
                            onClick={() =>
                              setSlides((current) => moveItem(current, index, 1))
                            }
                            className="dashboard-pro-btn-ghost px-2 py-1 text-[11px] disabled:opacity-40"
                            aria-label={`Move slide ${index + 1} down`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateSlide(slide)}
                            className="dashboard-pro-btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px]"
                          >
                            <CopyIcon className="h-3.5 w-3.5" />
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSlide(slide.id)}
                            className="dashboard-pro-btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px] text-rose-400"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="admin-homepage-slider-slide-body">
                        <div className="space-y-3">
                          {slide.imageUrl.trim() ? (
                            <SlideBannerImage
                              src={slide.imageUrl}
                              alt={slide.alt.trim() || `Slide ${index + 1} preview`}
                            />
                          ) : (
                            <div className="admin-homepage-slider-banner-frame relative aspect-[4/1] overflow-hidden rounded-xl border border-border/60 bg-[#01131a]">
                              <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
                                <ImageAttachIcon className="h-5 w-5 text-subtle" />
                                <p className="text-xs font-medium text-foreground-muted">
                                  {HOMEPAGE_SLIDE_BANNER_SIZE_HINT}
                                </p>
                                <p className="text-[11px] text-subtle">Upload a wide banner</p>
                              </div>
                            </div>
                          )}
                          <BannerUploadField
                            label={`slide ${index + 1} banner`}
                            recommendedSize={HOMEPAGE_SLIDE_BANNER_SIZE_HINT}
                            onUploaded={(url) => updateSlide(slide.id, { imageUrl: url })}
                          />
                        </div>

                        <div className="admin-homepage-slider-fields">
                          <Field label="Image URL">
                            <input
                              type="url"
                              value={slide.imageUrl}
                              onChange={(e) =>
                                updateSlide(slide.id, { imageUrl: e.target.value })
                              }
                              placeholder="/api/uploads/banners/your-banner.webp"
                              className={inputCls}
                            />
                          </Field>
                          <Field
                            label="Alt text"
                            hint="Describe the banner for accessibility and SEO."
                          >
                            <input
                              type="text"
                              value={slide.alt}
                              onChange={(e) => updateSlide(slide.id, { alt: e.target.value })}
                              placeholder="Steam gift card promotion"
                              className={inputCls}
                            />
                          </Field>
                          <Field
                            label="Click-through link"
                            hint="Optional. Opens when shoppers click this banner."
                          >
                            <input
                              type="text"
                              value={slide.href}
                              onChange={(e) => updateSlide(slide.id, { href: e.target.value })}
                              placeholder="/gift-cards"
                              className={inputCls}
                            />
                          </Field>
                          <label className="admin-homepage-slider-toggle">
                            <input
                              type="checkbox"
                              checked={slide.enabled}
                              onChange={(e) =>
                                updateSlide(slide.id, { enabled: e.target.checked })
                              }
                              className="rounded border-border"
                            />
                            <span>Show on homepage</span>
                          </label>
                        </div>
                      </div>
                    </article>
                  );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => addSlides(2)}
                    className="dashboard-pro-btn-ghost w-full justify-center py-2.5 text-xs"
                  >
                    + Add 2 slides
                  </button>
                </>
              )}
            </div>

            <section
              className="admin-appearance-actions-bar admin-homepage-slider-actions"
              aria-label="Publish homepage slider"
            >
              <div className="admin-appearance-actions-copy min-w-0">
                <span className="admin-appearance-actions-title">
                  Publish homepage slider
                </span>
                <span className="admin-appearance-actions-subtitle">
                  {isDirty
                    ? "You have unsaved changes — save to update the storefront."
                    : "All changes saved. Slides appear above category rows on the homepage."}
                </span>
              </div>

              <span className="admin-appearance-actions-publish">Publish</span>

              <div className="admin-appearance-actions-buttons">
                {!loading ? (
                  <button
                    type="button"
                    onClick={() => addSlides(2)}
                    className="dashboard-pro-btn-ghost px-4 py-2 text-sm"
                  >
                    + Add 2 slides
                  </button>
                ) : null}
                <Link
                  href="/"
                  target="_blank"
                  className="dashboard-pro-btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  Preview
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || loading || !isDirty}
                  className="btn-primary btn-primary-sm disabled:opacity-50"
                >
                  {saving ? "Publishing…" : "Save & publish"}
                </button>
              </div>
            </section>
          </>
        }
      />
    </div>
  );
}
