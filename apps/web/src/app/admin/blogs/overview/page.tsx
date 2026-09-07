"use client";

import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  blogStatusBadgeClass,
  blogStatusLabel,
  formatAdminBlogDate,
} from "@/components/admin/blog-form-shared";
import {
  CheckIcon,
  FileIcon,
  GridIcon,
  LayersIcon,
  LinkIcon,
  PulseIcon,
  SettingsIcon,
  TagIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useBlogWorkspaceBase } from "@/hooks/useBlogWorkspaceBase";
import { CUSTOMER_BLOG_WORKSPACE_PREFIX } from "@/lib/blog-workspace";
import { getBlogAdminOverview } from "@/lib/api";
import { formatBlogAuthorName } from "@/lib/blog-author";
import { queryKeys } from "@/lib/query-keys";
import { blogCategoryPath } from "@/lib/seo";

type StatTone = "brand" | "success" | "amber" | "muted";

type BlogPostsHref =
  | "/admin/blogs"
  | "/dashboard/blogs"
  | `/admin/blogs?${string}`
  | `/dashboard/blogs?${string}`;

type BlogEditHref =
  | `/admin/blogs/${string}/edit`
  | `/dashboard/blogs/${string}/edit`;

type BlogWorkspaceHref =
  | BlogPostsHref
  | BlogEditHref
  | "/admin/blogs/create"
  | "/dashboard/blogs/create"
  | "/admin/blogs/categories"
  | "/dashboard/blogs/categories"
  | "/admin/blogs/settings"
  | "/dashboard/blogs/settings";

function blogPostsHref(
  isCustomerWorkspace: boolean,
  query?: string,
): BlogPostsHref {
  if (!query) {
    return isCustomerWorkspace ? "/dashboard/blogs" : "/admin/blogs";
  }
  return isCustomerWorkspace
    ? `/dashboard/blogs?${query}`
    : `/admin/blogs?${query}`;
}

function blogEditHref(
  isCustomerWorkspace: boolean,
  id: string,
): BlogEditHref {
  const encodedId = encodeURIComponent(id);
  return isCustomerWorkspace
    ? `/dashboard/blogs/${encodedId}/edit`
    : `/admin/blogs/${encodedId}/edit`;
}

function blogNavHref(
  isCustomerWorkspace: boolean,
  path: "posts" | "create" | "categories" | "settings",
): BlogWorkspaceHref {
  if (path === "posts") return blogPostsHref(isCustomerWorkspace);
  if (path === "create") {
    return isCustomerWorkspace
      ? "/dashboard/blogs/create"
      : "/admin/blogs/create";
  }
  if (path === "categories") {
    return isCustomerWorkspace
      ? "/dashboard/blogs/categories"
      : "/admin/blogs/categories";
  }
  return isCustomerWorkspace
    ? "/dashboard/blogs/settings"
    : "/admin/blogs/settings";
}

type OverviewStat = {
  key: string;
  tone: StatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
  href?: BlogWorkspaceHref;
};

function OverviewStatsGrid({ items }: { items: OverviewStat[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-blogs-overview"
      aria-label="Blog overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item) => {
          const inner = (
            <>
              <span
                className="customer-dashboard-overview-stat-glow"
                aria-hidden
              />
              <span
                className="customer-dashboard-overview-stat-icon"
                aria-hidden
              >
                {item.icon}
              </span>
              <div className="customer-dashboard-overview-stat-copy min-w-0">
                <dt className="customer-dashboard-overview-stat-label">
                  {item.label}
                </dt>
                <dd className="customer-dashboard-overview-stat-value">
                  {item.value}
                </dd>
                <p className="customer-dashboard-overview-stat-meta">
                  {item.meta}
                </p>
              </div>
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} transition hover:opacity-90`}
              >
                {inner}
              </Link>
            );
          }

          return (
            <div
              key={item.key}
              className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone}`}
            >
              {inner}
            </div>
          );
        })}
      </dl>
    </section>
  );
}

const QUICK_LINK_BUILDERS = [
  {
    path: "posts" as const,
    label: "All Posts",
    description: "Browse, filter, and manage every article.",
    icon: LinkIcon,
    permission: "view_blog_posts" as const,
  },
  {
    path: "create" as const,
    label: "Create Post",
    description: "Write a new blog article.",
    icon: TagIcon,
    permission: "create_edit_blog_posts" as const,
  },
  {
    path: "categories" as const,
    label: "Categories",
    description: "Organize posts with named categories.",
    icon: LayersIcon,
    permission: "manage_blog_categories" as const,
  },
  {
    path: "settings" as const,
    label: "Settings",
    description: "Turn likes, reviews, views, and profile features on or off.",
    icon: SettingsIcon,
    permission: "view_blog_overview" as const,
  },
  {
    href: "/blog",
    label: "View storefront",
    description: "Open the public blog in a new tab.",
    icon: GridIcon,
    permission: "view_blog_posts" as const,
    external: true,
  },
] as const;

export default function AdminBlogOverviewPage() {
  const workspaceBase = useBlogWorkspaceBase();
  const isCustomerWorkspace =
    workspaceBase === CUSTOMER_BLOG_WORKSPACE_PREFIX;
  const blogCreateHref = isCustomerWorkspace
    ? "/dashboard/blogs/create"
    : "/admin/blogs/create";
  const blogCategoriesHref = isCustomerWorkspace
    ? "/dashboard/blogs/categories"
    : "/admin/blogs/categories";
  const {
    canViewBlogOverview,
    canViewBlog,
    canEditBlog,
    canPublishBlog,
    canManageBlogCategories,
    canViewAllBlogPosts,
    isLoading: permsLoading,
  } = useAdminPermissions();

  const overviewQuery = useQuery({
    queryKey: queryKeys.admin.blog.overview,
    queryFn: getBlogAdminOverview,
    enabled: canViewBlogOverview,
    staleTime: 30_000,
  });

  const data = overviewQuery.data;
  const loading = overviewQuery.isPending;

  const postStats = useMemo<OverviewStat[]>(() => {
    const posts = data?.posts;
    return [
      {
        key: "total",
        tone: "brand",
        icon: <FileIcon className="h-4 w-4" />,
        label: "Total posts",
        value: loading ? "…" : String(posts?.total ?? 0),
        meta: "All articles in CMS",
        href: blogPostsHref(isCustomerWorkspace),
      },
      {
        key: "published",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Published",
        value: loading ? "…" : String(posts?.published ?? 0),
        meta: "Live on storefront",
        href: blogPostsHref(isCustomerWorkspace, "status=published"),
      },
      {
        key: "pending",
        tone: "amber",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Pending review",
        value: loading ? "…" : String(posts?.pending ?? 0),
        meta: "Awaiting approval",
        href: blogPostsHref(isCustomerWorkspace, "status=pending"),
      },
      {
        key: "draft",
        tone: "muted",
        icon: <FileIcon className="h-4 w-4" />,
        label: "Drafts",
        value: loading ? "…" : String(posts?.draft ?? 0),
        meta: "Unpublished work in progress",
        href: blogPostsHref(isCustomerWorkspace, "status=draft"),
      },
      {
        key: "rejected",
        tone: "brand",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Rejected",
        value: loading ? "…" : String(posts?.rejected ?? 0),
        meta: "Needs author revision",
        href: blogPostsHref(isCustomerWorkspace, "status=rejected"),
      },
      {
        key: "views",
        tone: "brand",
        icon: <GridIcon className="h-4 w-4" />,
        label: "Total views",
        value: loading
          ? "…"
          : (posts?.totalViews ?? 0).toLocaleString(),
        meta: "All-time article views",
      },
      {
        key: "week",
        tone: "success",
        icon: <TagIcon className="h-4 w-4" />,
        label: "New this week",
        value: loading ? "…" : String(posts?.createdThisWeek ?? 0),
        meta: "Posts created in 7 days",
      },
      {
        key: "today",
        tone: "amber",
        icon: <TagIcon className="h-4 w-4" />,
        label: "New today",
        value: loading ? "…" : String(posts?.createdToday ?? 0),
        meta: "Posts created today",
      },
    ];
  }, [data?.posts, isCustomerWorkspace, loading]);

  const categoryStats = useMemo<OverviewStat[]>(() => {
    const cats = data?.categories;
    return [
      {
        key: "cat-total",
        tone: "brand",
        icon: <LayersIcon className="h-4 w-4" />,
        label: "Categories",
        value: loading ? "…" : String(cats?.total ?? 0),
        meta: "Blog category count",
        href: canManageBlogCategories ? blogCategoriesHref : undefined,
      },
      {
        key: "cat-active",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Active categories",
        value: loading ? "…" : String(cats?.active ?? 0),
        meta: "Visible on storefront",
      },
      {
        key: "cat-inactive",
        tone: "muted",
        icon: <LayersIcon className="h-4 w-4" />,
        label: "Inactive categories",
        value: loading ? "…" : String(cats?.inactive ?? 0),
        meta: "Hidden from public blog",
      },
    ];
  }, [blogCategoriesHref, canManageBlogCategories, data?.categories, loading]);

  const visibleQuickLinks = useMemo(
    () =>
      QUICK_LINK_BUILDERS.filter((link) => {
        if (link.permission === "view_blog_overview") return canViewBlogOverview;
        if (link.permission === "create_edit_blog_posts") return canEditBlog;
        if (link.permission === "manage_blog_categories") {
          return canManageBlogCategories;
        }
        return canViewBlog;
      }).map((link) => {
        if ("href" in link) return link;
        const href = blogNavHref(isCustomerWorkspace, link.path);
        if (link.path === "posts" && isCustomerWorkspace) {
          const postsLabel = canViewAllBlogPosts ? "All Posts" : "My Posts";
          return {
            ...link,
            href,
            label: postsLabel,
            description: canViewAllBlogPosts
              ? "Browse, filter, and manage every article."
              : "Browse and manage articles you have written.",
          };
        }
        return { ...link, href };
      }),
    [
      canEditBlog,
      canManageBlogCategories,
      canViewBlog,
      canViewBlogOverview,
      canViewAllBlogPosts,
      isCustomerWorkspace,
    ],
  );

  if (permsLoading) {
    return (
      <AdminPageLayout
        section="Content"
        title="Blog overview"
        icon={GridIcon}
        backHref="/dashboard"
        backLabel="Dashboard"
        loading
        loadingText="Checking access…"
      />
    );
  }

  if (!canViewBlogOverview) {
    return (
      <AdminPageLayout
        section="Content"
        title="Blog overview"
        icon={GridIcon}
        backHref="/dashboard"
        backLabel="Dashboard"
      >
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          You do not have permission to view the blog overview.
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      section="Content"
      title="Blog overview"
      description="Posts, categories, review queue, and storefront activity at a glance."
      icon={GridIcon}
      backHref="/dashboard"
      backLabel="Dashboard"
      loading={loading && !data}
      loadingText="Loading blog overview…"
      action={
        canEditBlog ? (
          <Link href={blogCreateHref} className="btn-primary btn-primary-sm">
            + Create Post
          </Link>
        ) : undefined
      }
    >
      {overviewQuery.isError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Could not load blog overview.
        </div>
      ) : null}

      <OverviewStatsGrid items={postStats} />

      <div className="mt-4">
        <OverviewStatsGrid items={categoryStats} />
      </div>

      <ProductFormOrderCard
        title="Quick links"
        subtitle="Jump to common blog management tasks."
        className="mt-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleQuickLinks.map((link) => {
            const Icon = link.icon;
            const className =
              "admin-blogs-quick-link flex min-h-[5.5rem] flex-col rounded-xl border border-border/60 bg-surface/40 p-4 transition hover:border-brand/40 hover:bg-surface/70";
            const content = (
              <>
                <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-medium text-foreground">{link.label}</span>
                <span className="mt-1 text-xs text-subtle">
                  {link.description}
                </span>
              </>
            );
            if ("external" in link && link.external) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {content}
                </a>
              );
            }
            return (
              <Link key={link.href} href={link.href} className={className}>
                {content}
              </Link>
            );
          })}
        </div>
      </ProductFormOrderCard>

      <div className="mt-5">
        <AdminOrderTwoColumnLayout
          main={
            <AdminOrderListCard
              icon={<LinkIcon className="h-4 w-4" />}
              title="Recent posts"
              subtitle="Latest articles added to the blog."
            >
          {(data?.recentPosts ?? []).length === 0 ? (
            <p className="dashboard-pro-empty py-8 text-sm text-subtle">
              No blog posts yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {(data?.recentPosts ?? []).map((post) => (
                <li
                  key={post.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={blogEditHref(isCustomerWorkspace, post.id)}
                      className="font-medium text-foreground hover:text-brand"
                    >
                      {post.title}
                    </Link>
                    <p className="text-xs text-subtle">
                      {formatBlogAuthorName(post.author, "—")} ·{" "}
                      {formatAdminBlogDate(post.createdAt)}
                    </p>
                  </div>
                  <span className={blogStatusBadgeClass(post.status)}>
                    {blogStatusLabel(post.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
            </AdminOrderListCard>
          }
          sidebar={
            <div className="space-y-5">
          {canPublishBlog ? (
            <AdminOrderListCard
              icon={<PulseIcon className="h-4 w-4" />}
              title="Pending approval"
              subtitle={`${data?.posts.pending ?? 0} post${(data?.posts.pending ?? 0) === 1 ? "" : "s"} waiting`}
              action={
                <Link
                  href={blogPostsHref(isCustomerWorkspace, "status=pending")}
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  View all
                </Link>
              }
            >
              {(data?.pendingPosts ?? []).length === 0 ? (
                <p className="dashboard-pro-empty py-8 text-sm text-subtle">
                  No posts awaiting review.
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {(data?.pendingPosts ?? []).map((post) => (
                    <li
                      key={post.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={blogEditHref(isCustomerWorkspace, post.id)}
                          className="font-medium text-foreground hover:text-brand"
                        >
                          {post.title}
                        </Link>
                        <p className="text-xs text-subtle">
                          {formatBlogAuthorName(post.author, "—")}
                        </p>
                      </div>
                      <Link
                        href={blogPostsHref(
                          isCustomerWorkspace,
                          "status=pending",
                        )}
                        className="dashboard-pro-btn-ghost text-xs"
                      >
                        Review
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdminOrderListCard>
          ) : null}

          <AdminOrderListCard
            icon={<LayersIcon className="h-4 w-4" />}
            title="Top categories"
            subtitle="Categories with the most posts."
          >
            {(data?.topCategories ?? []).length === 0 ? (
              <p className="dashboard-pro-empty py-8 text-sm text-subtle">
                No categorized posts yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {(data?.topCategories ?? []).map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{cat.name}</p>
                      {cat.slug ? (
                        <a
                          href={blogCategoryPath(cat.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-subtle hover:text-brand"
                        >
                          /blog/category/{cat.slug}
                        </a>
                      ) : null}
                    </div>
                    <span className="dashboard-pro-status dashboard-pro-status--muted text-xs">
                      {cat.postCount} post{cat.postCount === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminOrderListCard>
            </div>
          }
        />
      </div>
    </AdminPageLayout>
  );
}
