import type { BlogStatus } from "@/lib/api";
import { toMetaText } from "@/lib/seo";
import {
  getPrimaryKeyword,
  isSeoFriendlySlug,
  type ProductSeoCheck,
  type ProductSeoScoreResult,
  type ProductSeoScoreTone,
} from "@/lib/product-seo-score";

/** Minimum SEO score required to submit for review or publish. */
export const MIN_BLOG_SEO_SCORE_TO_SUBMIT = 95;

export function isBlogSeoScoreReadyToSubmit(score: number): boolean {
  return score >= MIN_BLOG_SEO_SCORE_TO_SUBMIT;
}

export function getBlogSeoStatusLabel(score: number): {
  label: string;
  tone: ProductSeoScoreTone;
} {
  if (score >= MIN_BLOG_SEO_SCORE_TO_SUBMIT) {
    return { label: "Ready to submit", tone: "excellent" };
  }
  if (score >= 90) {
    return { label: "Almost ready", tone: "good" };
  }
  if (score >= 70) {
    return { label: "Good SEO", tone: "good" };
  }
  if (score >= 50) {
    return { label: "Needs improvement", tone: "needs-improvement" };
  }
  return { label: "Poor SEO", tone: "poor" };
}

export type BlogSeoScoreInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  ogImage: string;
  categoryId: string;
  tagsInput: string;
  focusKeyword: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  status: BlogStatus;
};

function plainText(value: string): string {
  return toMetaText(value, 50_000);
}

function wordCount(value: string): number {
  const text = plainText(value);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function getBlogPrimaryKeyword(
  focusKeyword: string,
  tagsInput: string,
  title: string,
): string | null {
  const focus = focusKeyword.trim().toLowerCase();
  if (focus) return focus;
  return getPrimaryKeyword(tagsInput, title);
}

function containsKeyword(text: string, keyword: string | null): boolean {
  if (!keyword) return true;
  return plainText(text).toLowerCase().includes(keyword);
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

function isSeoFriendlyImageFilename(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const pathname = new URL(trimmed, "https://uniqbd.com").pathname;
    const base = pathname.split("/").pop() ?? "";
    const name = base.replace(/\.[a-z0-9]+$/i, "");
    if (!name || name.length < 3) return false;
    if (/^[a-f0-9-]{20,}$/i.test(name)) return false;
    return /[a-z]/i.test(name);
  } catch {
    const base = trimmed.split("/").pop() ?? trimmed;
    const name = base.replace(/\.[a-z0-9]+$/i, "");
    return name.length >= 3 && /[a-z]/i.test(name);
  }
}

export function computeBlogSeoScore(
  input: BlogSeoScoreInput,
): ProductSeoScoreResult {
  let score = 100;
  const checks: ProductSeoCheck[] = [];
  const warnings: string[] = [];

  const title = input.title.trim();
  const slug = input.slug.trim();
  const excerpt = input.excerpt.trim();
  const content = input.content.trim();
  const effectiveMetaTitle = input.metaTitle.trim() || title;
  const effectiveMetaDescription =
    input.metaDescription.trim() || excerpt;
  const primaryKeyword = getBlogPrimaryKeyword(
    input.focusKeyword,
    input.tagsInput,
    title,
  );
  const shareImage = input.ogImage.trim() || input.featuredImage.trim();
  const hasTags = input.tagsInput
    .split(",")
    .map((t) => t.trim())
    .some(Boolean);

  // 1. Post title
  if (!title) {
    score -= 15;
    checks.push({
      id: "title",
      label: "Post title",
      status: "fail",
      detail: "Add a post title",
    });
  } else {
    const titleLen = title.length;
    const titleLengthOk = titleLen >= 30 && titleLen <= 70;
    const keywordInTitle = containsKeyword(title, primaryKeyword);
    if (!titleLengthOk) score -= 5;
    if (!keywordInTitle) warnings.push("Add focus keyword to the post title");
    checks.push({
      id: "title",
      label: "Post title optimized",
      status: titleLengthOk && keywordInTitle ? "pass" : "warn",
      detail: titleLengthOk
        ? keywordInTitle
          ? undefined
          : "Include your focus keyword in the title"
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
  if (!effectiveMetaTitle) {
    score -= 15;
    checks.push({
      id: "meta-title",
      label: "Meta title",
      status: "fail",
      detail: "Add a meta title for search results",
    });
  } else {
    const metaTitleLen = effectiveMetaTitle.length;
    const metaTitleLengthOk = metaTitleLen >= 50 && metaTitleLen <= 60;
    const keywordInMetaTitle = containsKeyword(
      effectiveMetaTitle,
      primaryKeyword,
    );
    if (!input.metaTitle.trim()) warnings.push("Set a dedicated meta title");
    if (!metaTitleLengthOk) score -= 5;
    if (!keywordInMetaTitle) warnings.push("Add focus keyword to meta title");
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
  if (!effectiveMetaDescription) {
    score -= 15;
    checks.push({
      id: "meta-description",
      label: "Meta description",
      status: "fail",
      detail: "Add a meta description for search snippets",
    });
  } else {
    const metaDescLen = effectiveMetaDescription.length;
    const metaDescLengthOk = metaDescLen >= 120 && metaDescLen <= 160;
    const keywordInMetaDesc = containsKeyword(
      effectiveMetaDescription,
      primaryKeyword,
    );
    if (!input.metaDescription.trim()) {
      warnings.push("Set a dedicated meta description");
    }
    if (!metaDescLengthOk) score -= 5;
    if (!keywordInMetaDesc) {
      warnings.push("Add focus keyword to meta description");
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

  // 5. Excerpt & content
  if (!excerpt) {
    score -= 10;
    checks.push({
      id: "excerpt",
      label: "Short description",
      status: "fail",
      detail: "Add an excerpt for listing cards and SEO fallback",
    });
  } else {
    const excerptLen = excerpt.length;
    const excerptOk = excerptLen >= 80 && excerptLen <= 200;
    if (!excerptOk) warnings.push("Keep excerpt between 80–200 characters");
    checks.push({
      id: "excerpt",
      label: "Short description length",
      status: excerptOk ? "pass" : "warn",
      detail: excerptOk
        ? undefined
        : `Currently ${excerptLen} characters — aim for 80–200`,
    });
  }

  if (!content) {
    score -= 20;
    checks.push({
      id: "content",
      label: "Article content",
      status: "fail",
      detail: "Write the full article body",
    });
  } else {
    const words = wordCount(content);
    const headings = hasHeadings(content);
    const bullets = hasBulletPoints(content);
    const keywordInContent = containsKeyword(content, primaryKeyword);

    if (words < 300) warnings.push("Add more content — aim for 300+ words");
    if (!headings) warnings.push("Use headings to structure the article");
    if (!bullets) warnings.push("Add bullet points for key takeaways");
    if (!keywordInContent) warnings.push("Add focus keyword naturally in content");

    checks.push({
      id: "content",
      label: "Content has keywords",
      status: keywordInContent && words >= 300 ? "pass" : "warn",
      detail:
        words >= 300
          ? keywordInContent
            ? undefined
            : "Work in your focus keyword naturally"
          : `Add at least 300 words (currently ${words})`,
    });
    checks.push({
      id: "content-structure",
      label: "Content structure",
      status: headings ? "pass" : "warn",
      detail: headings ? undefined : "Use H2/H3 headings in the editor",
    });
  }

  // 6. Featured & social images
  const hasFeatured = Boolean(input.featuredImage.trim());
  const hasShareImage = Boolean(shareImage);

  if (!hasFeatured) score -= 15;
  checks.push({
    id: "featured-image",
    label: "Featured image added",
    status: hasFeatured ? "pass" : "fail",
    detail: hasFeatured ? undefined : "Upload a featured image",
  });
  checks.push({
    id: "og-image",
    label: "Social share image",
    status: hasShareImage ? "pass" : "warn",
    detail: hasShareImage
      ? undefined
      : "Set OG image or use featured image fallback",
  });
  if (
    hasFeatured &&
    !isSeoFriendlyImageFilename(input.featuredImage)
  ) {
    warnings.push("Use a descriptive featured image filename");
  }

  // 7. Category, focus keyword, tags
  const hasCategory = Boolean(input.categoryId.trim());
  const hasFocusKeyword = Boolean(input.focusKeyword.trim());

  if (!hasCategory) score -= 10;
  checks.push({
    id: "category",
    label: "Category selected",
    status: hasCategory ? "pass" : "fail",
    detail: hasCategory ? undefined : "Select a blog category",
  });
  checks.push({
    id: "focus-keyword",
    label: "Focus keyword set",
    status: hasFocusKeyword ? "pass" : "warn",
    detail: hasFocusKeyword ? undefined : "Add a primary keyword to target",
  });
  checks.push({
    id: "tags",
    label: "Tags added",
    status: hasTags ? "pass" : "warn",
    detail: hasTags ? undefined : "Add comma-separated tags",
  });

  // 8. Article schema readiness
  const schemaReady =
    Boolean(title) && hasFeatured && Boolean(content) && input.status === "published";

  checks.push({
    id: "schema-headline",
    label: "Schema: headline",
    status: title ? "pass" : "fail",
  });
  checks.push({
    id: "schema-image",
    label: "Schema: image",
    status: hasFeatured ? "pass" : "fail",
  });
  checks.push({
    id: "schema-body",
    label: "Schema: article body",
    status: content ? "pass" : "fail",
  });
  checks.push({
    id: "schema-published",
    label: "Schema: published date",
    status: input.status === "published" ? "pass" : "warn",
    detail:
      input.status === "published"
        ? undefined
        : "Set status to Published for live article schema",
  });

  if (!schemaReady) {
    warnings.push("Publish with title, image, and content for article rich results");
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const { label, tone } = getBlogSeoStatusLabel(finalScore);

  return {
    score: finalScore,
    statusLabel: label,
    tone,
    checks,
    warnings: [...new Set(warnings)],
  };
}
