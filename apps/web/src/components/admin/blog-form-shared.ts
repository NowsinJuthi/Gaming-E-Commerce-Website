import type { BlogPost, AdminBlogPayload, BlogStatus } from "@/lib/api";
import { formatBlogAuthorName } from "@/lib/blog-author";
import {
  computeBlogSeoScore,
  MIN_BLOG_SEO_SCORE_TO_SUBMIT,
  type BlogSeoScoreInput,
} from "@/lib/blog-seo-score";
import { slugify } from "@/lib/slugify";

export type BlogFormState = {
  title: string;
  slug: string;
  slugManual: boolean;
  excerpt: string;
  content: string;
  featuredImage: string;
  categoryId: string;
  tagsInput: string;
  status: BlogStatus;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  ogImage: string;
  authorDisplay: string;
};

export const EMPTY_BLOG_FORM: BlogFormState = {
  title: "",
  slug: "",
  slugManual: false,
  excerpt: "",
  content: "",
  featuredImage: "",
  categoryId: "",
  tagsInput: "",
  status: "draft",
  metaTitle: "",
  metaDescription: "",
  focusKeyword: "",
  canonicalUrl: "",
  ogImage: "",
  authorDisplay: "",
};

export function parseTagsInput(input: string): string[] {
  return [
    ...new Set(
      input
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function tagsToInput(tags: string[] | undefined): string {
  return (tags ?? []).join(", ");
}

export function blogPostToForm(post: BlogPost): BlogFormState {
  return {
    title: post.title,
    slug: post.slug,
    slugManual: true,
    excerpt: post.excerpt ?? "",
    content: post.content ?? "",
    featuredImage: post.featuredImage ?? "",
    categoryId: post.categoryId ?? "",
    tagsInput: tagsToInput(post.tags),
    status: (post.status as BlogStatus) || "draft",
    metaTitle: post.metaTitle ?? "",
    metaDescription: post.metaDescription ?? "",
    focusKeyword: post.focusKeyword ?? "",
    canonicalUrl: post.canonicalUrl ?? "",
    ogImage: post.ogImage ?? "",
    authorDisplay: formatBlogAuthorName(post.author, "Admin"),
  };
}

export function buildBlogPayload(form: BlogFormState): AdminBlogPayload {
  const tags = parseTagsInput(form.tagsInput);
  const focus = form.focusKeyword.trim().toLowerCase();
  if (focus && !tags.includes(focus)) {
    tags.unshift(focus);
  }

  return {
    title: form.title.trim(),
    slug: form.slug.trim() || slugify(form.title),
    excerpt: form.excerpt.trim(),
    content: form.content,
    featuredImage: form.featuredImage.trim() || undefined,
    ogImage: form.ogImage.trim() || undefined,
    categoryId: form.categoryId.trim() || undefined,
    tags,
    status: form.status,
    metaTitle: form.metaTitle.trim() || undefined,
    metaDescription: form.metaDescription.trim() || undefined,
    focusKeyword: focus || undefined,
    canonicalUrl: form.canonicalUrl.trim() || undefined,
  };
}

export function blogFormToSeoInput(form: BlogFormState): BlogSeoScoreInput {
  return {
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt,
    content: form.content,
    featuredImage: form.featuredImage,
    ogImage: form.ogImage,
    categoryId: form.categoryId,
    tagsInput: form.tagsInput,
    focusKeyword: form.focusKeyword,
    metaTitle: form.metaTitle,
    metaDescription: form.metaDescription,
    canonicalUrl: form.canonicalUrl,
    status: form.status,
  };
}

export type BlogSubmitIntent = "submit" | "draft";

export function validateBlogSeoScoreForSubmit(
  form: BlogFormState,
  intent: BlogSubmitIntent = "submit",
): string | null {
  if (intent === "draft") return null;

  const { score } = computeBlogSeoScore(blogFormToSeoInput(form));
  if (score >= MIN_BLOG_SEO_SCORE_TO_SUBMIT) return null;

  return `SEO score is ${score}/100. Improve SEO to at least ${MIN_BLOG_SEO_SCORE_TO_SUBMIT} before submitting or publishing this post. Use "Save as draft" to keep working without publishing.`;
}

export function isBlogSubmitBlockedBySeo(form: BlogFormState): boolean {
  return validateBlogSeoScoreForSubmit(form, "submit") !== null;
}

export function validateBlogForm(
  form: BlogFormState,
  intent: BlogSubmitIntent = "submit",
): string | null {
  if (!form.title.trim()) return "Title is required.";
  if (!form.excerpt.trim()) return "Short description is required.";
  if (!form.content.trim()) return "Content is required.";
  if (!form.featuredImage.trim()) {
    return "Featured image is required.";
  }
  if (!form.categoryId.trim()) return "Category is required.";
  if (intent === "submit" && !form.status) return "Status is required.";
  return validateBlogSeoScoreForSubmit(form, intent);
}

export function formatAdminBlogDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function blogStatusLabel(status: string): string {
  switch (status) {
    case "published":
      return "Published";
    case "pending":
      return "Pending review";
    case "rejected":
      return "Rejected";
    default:
      return "Draft";
  }
}

export function blogStatusBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "dashboard-pro-status dashboard-pro-status--green";
    case "pending":
      return "dashboard-pro-status dashboard-pro-status--amber";
    case "rejected":
      return "dashboard-pro-status dashboard-pro-status--rose";
    default:
      return "dashboard-pro-status dashboard-pro-status--muted";
  }
}

export function blogStatusOptions(canPublish: boolean): Array<{
  value: BlogStatus;
  label: string;
}> {
  if (canPublish) {
    return [
      { value: "draft", label: "Draft" },
      { value: "pending", label: "Pending review" },
      { value: "published", label: "Published" },
      { value: "rejected", label: "Rejected" },
    ];
  }
  return [
    { value: "draft", label: "Draft (save only)" },
    { value: "pending", label: "Submit for review" },
  ];
}
