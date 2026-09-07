import type { ProductStatusValue } from "@/lib/api";
import { toMetaText } from "@/lib/seo";

export type ProductSeoScoreInput = {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  shortDescription: string;
  description: string;
  mediaItems: Array<{ url: string; alt?: string }>;
  categoryIds: string[];
  brandId: string;
  status: ProductStatusValue;
  variations: Array<{ price: number; imageUrl?: string }>;
};

export type SeoCheckStatus = "pass" | "warn" | "fail";

export type ProductSeoCheck = {
  id: string;
  label: string;
  status: SeoCheckStatus;
  detail?: string;
};

export type ProductSeoScoreTone =
  | "excellent"
  | "good"
  | "needs-improvement"
  | "poor";

export type ProductSeoScoreResult = {
  score: number;
  statusLabel: string;
  tone: ProductSeoScoreTone;
  checks: ProductSeoCheck[];
  warnings: string[];
};

function plainText(value: string): string {
  return toMetaText(value, 50_000);
}

function wordCount(value: string): number {
  const text = plainText(value);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function getPrimaryKeyword(
  keywords: string,
  title: string,
): string | null {
  const fromKeywords = keywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 1);
  if (fromKeywords.length > 0) return fromKeywords[0] ?? null;

  const fromTitle = title
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ""))
    .filter((w) => w.length > 2);
  return fromTitle[0] ?? null;
}

function containsKeyword(text: string, keyword: string | null): boolean {
  if (!keyword) return true;
  return plainText(text).toLowerCase().includes(keyword);
}

export function isSeoFriendlySlug(slug: string): boolean {
  const value = slug.trim();
  if (!value) return false;
  if (value !== value.toLowerCase()) return false;
  if (/\s/.test(value)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isSeoFriendlyImageFilename(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const pathname = new URL(trimmed, "https://uniqbd.com").pathname;
    const base = pathname.split("/").pop() ?? "";
    const name = base.replace(/\.[a-z0-9]+$/i, "");
    if (!name || name.length < 3) return false;
    if (/^[a-f0-9-]{20,}$/i.test(name)) return false;
    if (/^\d+$/.test(name)) return false;
    return /[a-z]/i.test(name);
  } catch {
    const base = trimmed.split("/").pop() ?? trimmed;
    const name = base.replace(/\.[a-z0-9]+$/i, "");
    return name.length >= 3 && /[a-z]/i.test(name);
  }
}

function hasHeadings(html: string): boolean {
  return /<(h[1-6])\b/i.test(html);
}

function hasBulletPoints(html: string): boolean {
  return (
    /<(ul|ol)\b/i.test(html) ||
    /<li\b/i.test(html) ||
    /^[\s]*[-*•]\s+/m.test(plainText(html))
  );
}

function isUniqueDescription(
  shortDescription: string,
  description: string,
): boolean {
  const short = plainText(shortDescription).toLowerCase();
  const full = plainText(description).toLowerCase();
  if (!short || !full) return Boolean(full);
  if (short === full) return false;
  if (full.includes(short) && full.length < short.length * 1.35) return false;
  return true;
}

export function getProductSeoStatusLabel(score: number): {
  label: string;
  tone: ProductSeoScoreTone;
} {
  if (score >= 90) {
    return { label: "Excellent SEO", tone: "excellent" };
  }
  if (score >= 70) {
    return { label: "Good SEO", tone: "good" };
  }
  if (score >= 50) {
    return { label: "Needs Improvement", tone: "needs-improvement" };
  }
  return { label: "Poor SEO", tone: "poor" };
}

export function computeProductSeoScore(
  input: ProductSeoScoreInput,
): ProductSeoScoreResult {
  let score = 100;
  const checks: ProductSeoCheck[] = [];
  const warnings: string[] = [];

  const title = input.title.trim();
  const slug = input.slug.trim();
  const metaTitle = input.metaTitle.trim();
  const metaDescription = input.metaDescription.trim();
  const descriptionText = plainText(
    input.description || input.shortDescription,
  );
  const fullDescription = input.description.trim();
  const shortDescription = input.shortDescription.trim();
  const primaryKeyword = getPrimaryKeyword(input.keywords, title);

  // 1. Product title
  if (!title) {
    score -= 15;
    checks.push({
      id: "title",
      label: "Product title",
      status: "fail",
      detail: "Add a product title",
    });
  } else {
    const titleLen = title.length;
    const titleLengthOk = titleLen >= 30 && titleLen <= 70;
    const keywordInTitle = containsKeyword(title, primaryKeyword);
    if (!titleLengthOk) score -= 5;
    if (!keywordInTitle) {
      warnings.push("Add main keyword to the product title");
    }
    checks.push({
      id: "title",
      label: "Product title optimized",
      status: titleLengthOk && keywordInTitle ? "pass" : "warn",
      detail: titleLengthOk
        ? keywordInTitle
          ? undefined
          : "Include your main keyword in the title"
        : `Use 30–70 characters (currently ${titleLen})`,
    });
  }

  // 2. Slug
  const slugOk = isSeoFriendlySlug(slug);
  if (!slugOk) score -= 10;
  checks.push({
    id: "slug",
    label: "SEO-friendly slug",
    status: slugOk ? "pass" : "fail",
    detail: slugOk
      ? undefined
      : "Use lowercase letters, numbers, and hyphens only",
  });

  // 3. Meta title
  if (!metaTitle) {
    score -= 15;
    checks.push({
      id: "meta-title",
      label: "Meta title",
      status: "fail",
      detail: "Add a meta title for search results",
    });
  } else {
    const metaTitleLen = metaTitle.length;
    const metaTitleLengthOk = metaTitleLen >= 50 && metaTitleLen <= 60;
    const keywordInMetaTitle = containsKeyword(metaTitle, primaryKeyword);
    if (!metaTitleLengthOk) score -= 5;
    if (!keywordInMetaTitle) {
      warnings.push("Add product keyword to meta title");
    }
    checks.push({
      id: "meta-title",
      label: "Meta title length",
      status: metaTitleLengthOk ? "pass" : "warn",
      detail: metaTitleLengthOk
        ? "Ideal 50–60 characters"
        : `Aim for 50–60 characters (currently ${metaTitleLen})`,
    });
  }

  // 4. Meta description
  if (!metaDescription) {
    score -= 15;
    checks.push({
      id: "meta-description",
      label: "Meta description",
      status: "fail",
      detail: "Add a meta description for search snippets",
    });
  } else {
    const metaDescLen = metaDescription.length;
    const metaDescLengthOk = metaDescLen >= 120 && metaDescLen <= 160;
    const keywordInMetaDesc = containsKeyword(metaDescription, primaryKeyword);
    if (!metaDescLengthOk) score -= 5;
    if (!keywordInMetaDesc) {
      warnings.push("Add product keyword to meta description");
    }
    checks.push({
      id: "meta-description",
      label: "Meta description length",
      status: metaDescLengthOk ? "pass" : "warn",
      detail: metaDescLengthOk
        ? "Ideal 120–160 characters"
        : `Aim for 120–160 characters (currently ${metaDescLen})`,
    });
  }

  // 5. Product description
  if (!descriptionText) {
    score -= 20;
    checks.push({
      id: "description",
      label: "Product description",
      status: "fail",
      detail: "Add a product description",
    });
  } else {
    const words = wordCount(fullDescription || shortDescription);
    const headings = hasHeadings(fullDescription || shortDescription);
    const bullets = hasBulletPoints(fullDescription || shortDescription);
    const keywordInDesc = containsKeyword(
      fullDescription || shortDescription,
      primaryKeyword,
    );
    const unique = isUniqueDescription(shortDescription, fullDescription);

    if (words < 40) warnings.push("Add more detail to the product description");
    if (!headings) warnings.push("Use headings in the product description");
    if (!bullets) warnings.push("Add bullet points to highlight benefits");
    if (!keywordInDesc) warnings.push("Add more description keywords");
    if (!unique) warnings.push("Make the full description unique vs short text");

    checks.push({
      id: "description",
      label: "Description has keywords",
      status: keywordInDesc && words >= 40 ? "pass" : "warn",
      detail:
        words >= 40
          ? keywordInDesc
            ? undefined
            : "Work in your main keyword naturally"
          : `Add at least 40 words (currently ${words})`,
    });
    checks.push({
      id: "description-structure",
      label: "Description structure",
      status: headings && bullets ? "pass" : "warn",
      detail:
        headings && bullets
          ? undefined
          : "Headings and bullet points improve readability",
    });
  }

  // 6. Images
  const galleryImages = input.mediaItems.filter((m) => m.url.trim());
  const variationImages = input.variations.filter((v) => v.imageUrl?.trim());
  const hasProductImage = galleryImages.length > 0 || variationImages.length > 0;
  const imagesMissingAlt = galleryImages.filter((m) => !m.alt?.trim());
  const unfriendlyFilenames = galleryImages.filter(
    (m) => !isSeoFriendlyImageFilename(m.url),
  );

  if (hasProductImage && imagesMissingAlt.length > 0) score -= 5;
  checks.push({
    id: "image",
    label: "Product image added",
    status: hasProductImage ? "pass" : "fail",
    detail: hasProductImage ? undefined : "Upload at least one product image",
  });
  checks.push({
    id: "image-alt",
    label: "Image alt text added",
    status:
      !hasProductImage || imagesMissingAlt.length === 0 ? "pass" : "warn",
    detail:
      imagesMissingAlt.length > 0
        ? `${imagesMissingAlt.length} image(s) missing alt text`
        : undefined,
  });
  if (unfriendlyFilenames.length > 0) {
    warnings.push("Use descriptive, SEO-friendly image filenames");
  }

  // 7. Category & attributes
  const hasCategory = input.categoryIds.length > 0;
  const hasBrand = Boolean(input.brandId.trim());
  const hasTags = input.keywords
    .split(",")
    .map((k) => k.trim())
    .some(Boolean);

  if (!hasCategory) score -= 10;
  checks.push({
    id: "category",
    label: "Category selected",
    status: hasCategory ? "pass" : "fail",
    detail: hasCategory ? undefined : "Select at least one category",
  });
  checks.push({
    id: "brand",
    label: "Brand selected",
    status: hasBrand ? "pass" : "warn",
    detail: hasBrand ? undefined : "Optional — add a brand when available",
  });
  checks.push({
    id: "keywords",
    label: "Tags / keywords added",
    status: hasTags ? "pass" : "warn",
    detail: hasTags ? undefined : "Add comma-separated keywords",
  });

  // 8. Structured data readiness
  const hasPrice = input.variations.some(
    (v) => Number.isFinite(v.price) && v.price > 0,
  );
  const hasAvailability =
    input.status === "active" || input.status === "out_of_stock";
  const schemaReady =
    Boolean(title) && hasProductImage && hasPrice && hasAvailability;

  checks.push({
    id: "schema-name",
    label: "Schema: product name",
    status: title ? "pass" : "fail",
  });
  checks.push({
    id: "schema-image",
    label: "Schema: product image",
    status: hasProductImage ? "pass" : "fail",
  });
  checks.push({
    id: "schema-price",
    label: "Schema: price",
    status: hasPrice ? "pass" : "warn",
    detail: hasPrice ? undefined : "Set variation prices",
  });
  checks.push({
    id: "schema-availability",
    label: "Schema: availability",
    status: hasAvailability ? "pass" : "warn",
    detail: hasAvailability
      ? undefined
      : "Active or out-of-stock status required",
  });
  checks.push({
    id: "schema-rating",
    label: "Schema: rating (optional)",
    status: "pass",
    detail: "Added automatically when reviews exist",
  });

  if (!schemaReady) {
    warnings.push("Complete name, image, price, and status for rich results");
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const { label, tone } = getProductSeoStatusLabel(finalScore);

  return {
    score: finalScore,
    statusLabel: label,
    tone,
    checks,
    warnings: [...new Set(warnings)],
  };
}
