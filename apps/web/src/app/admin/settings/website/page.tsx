"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { EyeIcon } from "@/components/admin/icons";
import {
  getAdminWebsiteSettings,
  revalidateWebsitePage,
  updateWebsiteSettings,
  type WebsitePageSettings,
  type WebsitePricingPackage,
} from "@/lib/api";
import { adminToast } from "@/lib/admin-toast";
import {
  DEFAULT_WEBSITE_PAGE_SETTINGS,
  normalizeWebsitePageSettings,
} from "@/lib/website-page-settings";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";
const textareaCls = "admin-input min-h-[180px] w-full";

function featuresToText(features: string[]): string {
  return features.join("\n");
}

function textToFeatures(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function initFeaturesDrafts(
  packages: WebsitePricingPackage[],
): Record<string, string> {
  return Object.fromEntries(
    packages.map((pkg) => [pkg.id, featuresToText(pkg.features)]),
  );
}

function mergeSettings(data: Partial<WebsitePageSettings>): WebsitePageSettings {
  return normalizeWebsitePageSettings({
    ...DEFAULT_WEBSITE_PAGE_SETTINGS,
    ...data,
    packages: data.packages ?? DEFAULT_WEBSITE_PAGE_SETTINGS.packages,
  });
}

function patchPackage(
  packages: WebsitePricingPackage[],
  index: number,
  patch: Partial<WebsitePricingPackage>,
): WebsitePricingPackage[] {
  return packages.map((pkg, i) => (i === index ? { ...pkg, ...patch } : pkg));
}

export default function WebsiteSettingsPage() {
  const [settings, setSettings] = useState<WebsitePageSettings>(
    DEFAULT_WEBSITE_PAGE_SETTINGS,
  );
  const [featuresDrafts, setFeaturesDrafts] = useState<Record<string, string>>(
    () => initFeaturesDrafts(DEFAULT_WEBSITE_PAGE_SETTINGS.packages),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminWebsiteSettings();
      const merged = mergeSettings(data);
      setSettings(merged);
      setFeaturesDrafts(initFeaturesDrafts(merged.packages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const packages = settings.packages.map((pkg) => ({
        ...pkg,
        features: textToFeatures(
          featuresDrafts[pkg.id] ?? featuresToText(pkg.features),
        ),
      }));

      const data = await updateWebsiteSettings({
        heroEyebrow: settings.heroEyebrow,
        heading: settings.heading,
        subheading: settings.subheading,
        offerTitle: settings.offerTitle,
        offerText: settings.offerText,
        heroNoteTitle: settings.heroNoteTitle,
        heroNoteText: settings.heroNoteText,
        heroNoteSubtext: settings.heroNoteSubtext,
        introSection: settings.introSection,
        guideSection: settings.guideSection,
        packages,
      });
      const merged = mergeSettings(data);
      setSettings(merged);
      setFeaturesDrafts(initFeaturesDrafts(merged.packages));
      adminToast("Website pricing saved");
      void revalidateWebsitePage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageLayout
      section="Settings"
      title="Website pricing"
      backHref="/admin/settings"
      backLabel="Settings"
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="space-y-5">
            <ProductFormOrderCard
              title="Top hero box"
              subtitle="Shows at the top of /website — eyebrow, title, subtitle, and special offer"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="website-hero-eyebrow">
                    Eyebrow badge (e.g. Website Development)
                  </label>
                  <input
                    id="website-hero-eyebrow"
                    className={inputCls}
                    value={settings.heroEyebrow}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        heroEyebrow: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="website-heading">
                    Main heading (e.g. Website Packages)
                  </label>
                  <input
                    id="website-heading"
                    className={inputCls}
                    value={settings.heading}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        heading: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="website-subheading">
                    Subheading (short description under title)
                  </label>
                  <textarea
                    id="website-subheading"
                    className={textareaCls}
                    value={settings.subheading}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        subheading: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="website-offer-title">
                    Offer label (e.g. বিশেষ অফার:)
                  </label>
                  <input
                    id="website-offer-title"
                    className={inputCls}
                    value={settings.offerTitle}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        offerTitle: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="website-offer-text">
                    Special offer text (বিশেষ অফার বিবরণ)
                  </label>
                  <textarea
                    id="website-offer-text"
                    className={textareaCls}
                    value={settings.offerText}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        offerText: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="website-note-title">
                    Custom note title (optional)
                  </label>
                  <input
                    id="website-note-title"
                    className={inputCls}
                    value={settings.heroNoteTitle}
                    placeholder="e.g. কাস্টম ওয়েবসাইট"
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        heroNoteTitle: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="website-note-text">
                    Custom note — main line (মূল লেখা)
                  </label>
                  <textarea
                    id="website-note-text"
                    className={textareaCls}
                    value={settings.heroNoteText}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        heroNoteText: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="website-note-subtext">
                    Custom note — second line (নিচের লেখা)
                  </label>
                  <textarea
                    id="website-note-subtext"
                    className={textareaCls}
                    value={settings.heroNoteSubtext}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        heroNoteSubtext: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </ProductFormOrderCard>

            {settings.packages.map((pkg, index) => (
              <ProductFormOrderCard
                key={pkg.id}
                title={`Package ${index + 1}: ${pkg.name || "Untitled"}`}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor={`pkg-name-${index}`}>
                      Package name
                    </label>
                    <input
                      id={`pkg-name-${index}`}
                      className={inputCls}
                      value={pkg.name}
                      disabled={loading}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          packages: patchPackage(prev.packages, index, {
                            name: e.target.value,
                          }),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`pkg-price-${index}`}>
                      Price
                    </label>
                    <input
                      id={`pkg-price-${index}`}
                      type="number"
                      min={0}
                      className={inputCls}
                      value={pkg.price}
                      disabled={loading}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          packages: patchPackage(prev.packages, index, {
                            price: Number(e.target.value) || 0,
                          }),
                        }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor={`pkg-subtitle-${index}`}>
                      Subtitle
                    </label>
                    <input
                      id={`pkg-subtitle-${index}`}
                      className={inputCls}
                      value={pkg.subtitle}
                      disabled={loading}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          packages: patchPackage(prev.packages, index, {
                            subtitle: e.target.value,
                          }),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`pkg-badge-${index}`}>
                      Badge (optional)
                    </label>
                    <input
                      id={`pkg-badge-${index}`}
                      className={inputCls}
                      value={pkg.badge}
                      placeholder="Most Popular"
                      disabled={loading}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          packages: patchPackage(prev.packages, index, {
                            badge: e.target.value,
                          }),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`pkg-cta-${index}`}>
                      Button label
                    </label>
                    <input
                      id={`pkg-cta-${index}`}
                      className={inputCls}
                      value={pkg.ctaLabel}
                      disabled={loading}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          packages: patchPackage(prev.packages, index, {
                            ctaLabel: e.target.value,
                          }),
                        }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor={`pkg-cta-href-${index}`}>
                      Button link
                    </label>
                    <input
                      id={`pkg-cta-href-${index}`}
                      className={inputCls}
                      value={pkg.ctaHref}
                      disabled={loading}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          packages: patchPackage(prev.packages, index, {
                            ctaHref: e.target.value,
                          }),
                        }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor={`pkg-features-${index}`}>
                      Features (one per line)
                    </label>
                    <textarea
                      id={`pkg-features-${index}`}
                      className={textareaCls}
                      value={featuresDrafts[pkg.id] ?? featuresToText(pkg.features)}
                      disabled={loading}
                      onChange={(e) =>
                        setFeaturesDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: e.target.value,
                        }))
                      }
                      onBlur={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          packages: patchPackage(prev.packages, index, {
                            features: textToFeatures(e.target.value),
                          }),
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-4 sm:col-span-2">
                    <label className="inline-flex items-center gap-2 text-sm text-foreground-muted">
                      <input
                        type="checkbox"
                        checked={pkg.highlighted}
                        disabled={loading}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            packages: patchPackage(prev.packages, index, {
                              highlighted: e.target.checked,
                            }),
                          }))
                        }
                      />
                      Highlight this package
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-foreground-muted">
                      <input
                        type="checkbox"
                        checked={pkg.enabled}
                        disabled={loading}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            packages: patchPackage(prev.packages, index, {
                              enabled: e.target.checked,
                            }),
                          }))
                        }
                      />
                      Show on website
                    </label>
                  </div>
                </div>
              </ProductFormOrderCard>
            ))}

            <ProductFormOrderCard title="Company intro (below pricing)">
              <div className="grid gap-4">
                <div>
                  <label className={labelCls} htmlFor="website-intro-title">
                    Section title
                  </label>
                  <input
                    id="website-intro-title"
                    className={inputCls}
                    value={settings.introSection.title}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        introSection: {
                          ...prev.introSection,
                          title: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="website-intro-paragraphs">
                    Paragraphs (one per line, blank line separates)
                  </label>
                  <textarea
                    id="website-intro-paragraphs"
                    className={textareaCls}
                    value={settings.introSection.paragraphs.join("\n\n")}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        introSection: {
                          ...prev.introSection,
                          paragraphs: e.target.value
                            .split(/\n\s*\n/)
                            .map((p) => p.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </ProductFormOrderCard>

            <ProductFormOrderCard title="Business guide (below pricing)">
              <div className="grid gap-4">
                <div>
                  <label className={labelCls} htmlFor="website-guide-title">
                    Section title
                  </label>
                  <input
                    id="website-guide-title"
                    className={inputCls}
                    value={settings.guideSection.title}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        guideSection: {
                          ...prev.guideSection,
                          title: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                {settings.guideSection.steps.map((step, index) => (
                  <div
                    key={`guide-step-${index}`}
                    className="rounded-xl border border-border/50 bg-muted/10 p-4"
                  >
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-brand">
                      Step {index + 1}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelCls} htmlFor={`guide-num-${index}`}>
                          Number
                        </label>
                        <input
                          id={`guide-num-${index}`}
                          className={inputCls}
                          value={step.number}
                          disabled={loading}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              guideSection: {
                                ...prev.guideSection,
                                steps: prev.guideSection.steps.map((s, i) =>
                                  i === index
                                    ? { ...s, number: e.target.value }
                                    : s,
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor={`guide-title-${index}`}>
                          Title
                        </label>
                        <input
                          id={`guide-title-${index}`}
                          className={inputCls}
                          value={step.title}
                          disabled={loading}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              guideSection: {
                                ...prev.guideSection,
                                steps: prev.guideSection.steps.map((s, i) =>
                                  i === index
                                    ? { ...s, title: e.target.value }
                                    : s,
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls} htmlFor={`guide-body-${index}`}>
                          Description
                        </label>
                        <textarea
                          id={`guide-body-${index}`}
                          className={textareaCls}
                          value={step.body}
                          disabled={loading}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              guideSection: {
                                ...prev.guideSection,
                                steps: prev.guideSection.steps.map((s, i) =>
                                  i === index
                                    ? { ...s, body: e.target.value }
                                    : s,
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ProductFormOrderCard>

        <section
          className="admin-appearance-actions-bar"
          aria-label="Publish website pricing"
        >
          <div className="admin-appearance-actions-copy min-w-0">
            <span className="admin-appearance-actions-title">
              Publish website pricing
            </span>
            <span className="admin-appearance-actions-subtitle">
              Save package names, prices, and features to the public /website
              page.
            </span>
          </div>

          <span className="admin-appearance-actions-publish">Publish</span>

          <div className="admin-appearance-actions-buttons">
            <Link
              href="/website"
              target="_blank"
              className="dashboard-pro-btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm"
            >
              <EyeIcon className="h-3.5 w-3.5" />
              Preview
            </Link>
            <button
              type="button"
              className="btn-primary btn-primary-sm disabled:opacity-50"
              disabled={loading || saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Publishing…" : "Save & publish"}
            </button>
          </div>
        </section>
      </div>
    </AdminPageLayout>
  );
}