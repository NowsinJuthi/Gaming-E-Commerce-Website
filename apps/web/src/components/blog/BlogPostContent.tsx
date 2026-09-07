import { sanitizeHtml } from "@/lib/sanitize";

type BlogPostContentProps = {
  html: string;
};

export function BlogPostContent({ html }: BlogPostContentProps) {
  const safe = sanitizeHtml(html);
  if (!safe) {
    return (
      <p className="blog-post-content blog-post-content--empty text-foreground-muted">
        This article has no content yet.
      </p>
    );
  }

  return (
    <div
      className="blog-post-content"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
