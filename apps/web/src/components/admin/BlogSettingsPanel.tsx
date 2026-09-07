"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import {
  getAdminBlogSettings,
  updateAdminBlogSettings,
  type BlogPageFeatures,
  type BlogPageSettings,
} from "@/lib/api";
import {
  BLOG_FEATURE_TOGGLES,
  DEFAULT_BLOG_PAGE_FEATURES,
  type BlogFeatureToggleKey,
} from "@/lib/blog-page-settings";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

function SettingSwitchRow({
  title,
  description,
  checked,
  disabled,
  ariaLabel,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="admin-payments-setting-row">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-foreground-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onToggle(!checked)}
        className={`admin-customer-panel-switch${
          checked ? " admin-customer-panel-switch--on" : ""
        } disabled:opacity-50`}
      >
        <span className="admin-customer-panel-switch-thumb" />
      </button>
    </div>
  );
}

type BlogSettingsPanelProps = {
  language?: "en" | "bn";
};

export function BlogSettingsPanel({ language = "en" }: BlogSettingsPanelProps) {
  const { can } = useAdminPermissions();
  const canEdit = can("publish_blog_posts");

  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<BlogPageFeatures>(
    DEFAULT_BLOG_PAGE_FEATURES,
  );
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [savingKey, setSavingKey] = useState<BlogFeatureToggleKey | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getAdminBlogSettings()
      .then((data: BlogPageSettings) => {
        setFeatures(data.features);
        setUpdatedAt(data.updatedAt);
      })
      .catch(() => {
        adminToast("Could not load blog settings.", false);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFeature(key: BlogFeatureToggleKey, enabled: boolean) {
    if (!canEdit || savingKey) return;

    const previous = features;
    const next: BlogPageFeatures = { ...features, [key]: enabled };
    setFeatures(next);
    setSavingKey(key);
    hideAdminToast();

    try {
      const saved = await updateAdminBlogSettings({ features: next });
      setFeatures(saved.features);
      setUpdatedAt(saved.updatedAt);
      adminToast("Blog settings saved.", true);
    } catch {
      setFeatures(previous);
      adminToast("Could not save blog settings.", false);
    } finally {
      setSavingKey(null);
    }
  }

  const enabledCount = BLOG_FEATURE_TOGGLES.filter(
    (item) => features[item.key],
  ).length;

  return (
    <div className="space-y-4">
      {!canEdit ? (
        <p
          className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200"
          role="status"
        >
          You can view these settings. Only users with publish permission can change
          them.
        </p>
      ) : null}

      <ProductFormOrderCard
        title="Article page features"
        subtitle={
          language === "bn"
            ? `${enabledCount}টি ফিচার চালু · পাবলিক ব্লগ পেজে প্রয়োগ হয়`
            : `${enabledCount} features on · Applies to public blog article pages`
        }
      >
        {loading ? (
          <p className="text-sm text-subtle">Loading blog settings…</p>
        ) : (
          <div className="space-y-3">
            {BLOG_FEATURE_TOGGLES.map((item) => (
              <SettingSwitchRow
                key={item.key}
                title={language === "bn" ? item.titleBn : item.title}
                description={
                  language === "bn" ? item.descriptionBn : item.description
                }
                checked={features[item.key]}
                disabled={!canEdit || savingKey === item.key}
                ariaLabel={`${item.title} ${features[item.key] ? "on" : "off"}`}
                onToggle={(enabled) => void toggleFeature(item.key, enabled)}
              />
            ))}
          </div>
        )}

        {updatedAt ? (
          <p className="mt-4 text-[11px] text-subtle">
            Last updated {new Date(updatedAt).toLocaleString()}
          </p>
        ) : null}
      </ProductFormOrderCard>
    </div>
  );
}
