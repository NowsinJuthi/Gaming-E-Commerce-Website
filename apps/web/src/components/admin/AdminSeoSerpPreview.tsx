"use client";

function plainPreviewText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

type AdminSeoSerpPreviewProps = {
  url: string;
  title: string;
  description?: string;
  label?: string;
};

export function AdminSeoSerpPreview({
  url,
  title,
  description = "",
  label = "Search preview",
}: AdminSeoSerpPreviewProps) {
  const plainDescription = plainPreviewText(description);

  return (
    <div className="admin-seo-serp-preview-wrap">
      {label ? (
        <p className="admin-seo-serp-preview-label">{label}</p>
      ) : null}
      <div className="admin-seo-serp-preview">
        <div className="admin-seo-serp-preview-breadcrumb">
          <span className="admin-seo-serp-preview-favicon" aria-hidden>
            A
          </span>
          <p className="admin-seo-serp-preview-url truncate">{url}</p>
        </div>
        <p className="admin-seo-serp-preview-title truncate">
          {title.trim() || "Product title"}
        </p>
        <p className="admin-seo-serp-preview-desc">
          {plainDescription || "Meta description preview…"}
        </p>
      </div>
    </div>
  );
}
