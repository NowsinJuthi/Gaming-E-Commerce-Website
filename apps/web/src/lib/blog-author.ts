import type { BlogAuthor, UserProfile } from "@/lib/api";
import { getCustomerDisplayName } from "@/lib/admin-order-view";

export function formatBlogAuthorName(
  author?: Pick<BlogAuthor, "name" | "email"> | null,
  fallback = "UniQbd",
): string {
  const name = author?.name?.trim();
  if (name) return name;

  const email = author?.email?.trim();
  if (email) {
    const at = email.indexOf("@");
    if (at > 0) return email.slice(0, at);
    return email;
  }

  return fallback;
}

export function userProfileToAuthorName(user: UserProfile): string {
  return getCustomerDisplayName(user);
}
