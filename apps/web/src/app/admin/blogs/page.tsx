"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { BlogFormPageLayout } from "@/components/admin/BlogFormPageLayout";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CheckIcon,
  FileIcon,
  GridIcon,
  LinkIcon,
  PulseIcon,
  SearchIcon,
} from "@/components/admin/icons";
import {
  blogStatusBadgeClass,
  blogStatusLabel,
  formatAdminBlogDate,
} from "@/components/admin/blog-form-shared";
import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import {
  approveBlog,
  changeBlogStatus,
  deleteBlog,
  getAdminBlogs,
  listAdminBlogCategories,
  rejectBlog,
  type BlogListItem,
  type BlogStatus,
} from "@/lib/api";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useBlogWorkspaceBase } from "@/hooks/useBlogWorkspaceBase";
import {
  CUSTOMER_BLOG_WORKSPACE_PREFIX,
  blogWorkspacePaths,
} from "@/lib/blog-workspace";
import { CONTACT_EMAIL_CARD_CLASS } from "@/components/contact/contact-email-card";
import { queryKeys } from "@/lib/query-keys";
import { blogPostPath } from "@/lib/seo";
import { resolveMediaSrc } from "@/lib/site-appearance";
import { formatBlogAuthorName } from "@/lib/blog-author";

const PAGE_SIZE = 10;

const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

type BlogEditHref =
  | `/admin/blogs/${string}/edit`
  | `/dashboard/blogs/${string}/edit`;

function blogEditHref(
  isCustomerWorkspace: boolean,
  id: string,
): BlogEditHref {
  const encodedId = encodeURIComponent(id);
  return isCustomerWorkspace
    ? `/dashboard/blogs/${encodedId}/edit`
    : `/admin/blogs/${encodedId}/edit`;
}

function isBlogStatus(value: string): value is BlogStatus {
  return (
    value === "draft" ||
    value === "pending" ||
    value === "published" ||
    value === "rejected"
  );
}

type BlogPostActionsProps = {
  item: BlogListItem;
  editHref: BlogEditHref;
  busy: boolean;
  canEditBlog: boolean;
  canPublishBlog: boolean;
  canDeleteBlog: boolean;
  variant: "table" | "card";
  onApprove: (item: BlogListItem) => void;
  onReject: (item: BlogListItem) => void;
  onToggleStatus: (item: BlogListItem) => void;
  onDelete: (item: BlogListItem) => void;
};

function BlogPostActions({
  item,
  editHref,
  busy,
  canEditBlog,
  canPublishBlog,
  canDeleteBlog,
  variant,
  onApprove,
  onReject,
  onToggleStatus,
  onDelete,
}: BlogPostActionsProps) {
  const tableBtn = "dashboard-pro-btn-ghost text-xs";
  const cardBtn = "blog-workspace-post-card__action";
  const btn = (kind: "default" | "primary" | "success" | "danger" = "default") => {
    if (variant === "table") {
      if (kind === "success") return `${tableBtn} text-emerald-300`;
      if (kind === "danger") return `${tableBtn} text-rose-300`;
      return tableBtn;
    }
    if (kind === "primary") return `${cardBtn} blog-workspace-post-card__action--primary`;
    if (kind === "success") return `${cardBtn} blog-workspace-post-card__action--success`;
    if (kind === "danger") return `${cardBtn} blog-workspace-post-card__action--danger`;
    return cardBtn;
  };

  return (
    <>
      {canEditBlog ? (
        <Link href={editHref} className={btn("primary")}>
          Edit
        </Link>
      ) : null}
      {item.status === "published" ? (
        <a
          href={blogPostPath(item.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className={btn()}
        >
          View
        </a>
      ) : null}
      {canPublishBlog && item.status === "pending" ? (
        <>
          <button
            type="button"
            className={btn("success")}
            disabled={busy}
            onClick={() => void onApprove(item)}
          >
            Approve
          </button>
          <button
            type="button"
            className={btn("danger")}
            disabled={busy}
            onClick={() => void onReject(item)}
          >
            Reject
          </button>
        </>
      ) : null}
      {canPublishBlog && item.status === "published" ? (
        <button
          type="button"
          className={btn()}
          disabled={busy}
          onClick={() => void onToggleStatus(item)}
        >
          Unpublish
        </button>
      ) : null}
      {canPublishBlog && item.status === "draft" ? (
        <button
          type="button"
          className={btn("success")}
          disabled={busy}
          onClick={() => void onToggleStatus(item)}
        >
          Publish
        </button>
      ) : null}
      {canDeleteBlog ? (
        <button
          type="button"
          className={btn("danger")}
          disabled={busy}
          onClick={() => void onDelete(item)}
        >
          Delete
        </button>
      ) : null}
    </>
  );
}

function BlogPostMobileCard({
  item,
  editHref,
  busy,
  canEditBlog,
  canPublishBlog,
  canDeleteBlog,
  onApprove,
  onReject,
  onToggleStatus,
  onDelete,
}: Omit<BlogPostActionsProps, "variant">) {
  const thumb = resolveMediaSrc(item.featuredImage ?? "");
  const author = formatBlogAuthorName(item.author, "—");

  return (
    <article className="blog-workspace-post-card">
      <div className="blog-workspace-post-card__media">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="blog-workspace-post-card__image"
          />
        ) : (
          <div className="blog-workspace-post-card__image-fallback" aria-hidden>
            <FileIcon className="h-7 w-7" />
          </div>
        )}
        <span className={blogStatusBadgeClass(item.status)}>{blogStatusLabel(item.status)}</span>
      </div>
      <div className="blog-workspace-post-card__body">
        <div className="blog-workspace-post-card__head">
          <div className="min-w-0">
            <h3 className="blog-workspace-post-card__title">{item.title}</h3>
            <p className="blog-workspace-post-card__slug">/{item.slug}</p>
          </div>
        </div>
        {item.excerpt ? (
          <p className="blog-workspace-post-card__excerpt">{item.excerpt}</p>
        ) : null}
        <ul className="blog-workspace-post-card__meta">
          <li>{item.category || "Uncategorized"}</li>
          <li>{author}</li>
          <li>{item.views.toLocaleString()} views</li>
          <li>{formatAdminBlogDate(item.createdAt)}</li>
        </ul>
        <div className="blog-workspace-post-card__actions">
          <BlogPostActions
            item={item}
            editHref={editHref}
            busy={busy}
            canEditBlog={canEditBlog}
            canPublishBlog={canPublishBlog}
            canDeleteBlog={canDeleteBlog}
            variant="card"
            onApprove={onApprove}
            onReject={onReject}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}

type BlogStatTone = "brand" | "success" | "amber" | "muted";

type BlogOverviewItem = {
  key: string;
  tone: BlogStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function BlogOverviewStats({ items }: { items: BlogOverviewItem[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-blogs-overview"
      aria-label="Blog overview"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone}`}
          >
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
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function AdminBlogsPage() {
  const blogPaths = blogWorkspacePaths(useBlogWorkspaceBase());
  const isCustomerWorkspace =
    blogPaths.base === CUSTOMER_BLOG_WORKSPACE_PREFIX;
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const {
    canViewBlog,
    canEditBlog,
    canDeleteBlog,
    canPublishBlog,
    canViewAllBlogPosts,
    isLoading: permsLoading,
  } = useAdminPermissions();
  const showAllCustomerPosts =
    isCustomerWorkspace && canViewAllBlogPosts;
  const postsListTitle = isCustomerWorkspace
    ? showAllCustomerPosts
      ? "All Posts"
      : "My Posts"
    : "All Posts";
  const pageTitle = postsListTitle;
  const pageDescription = isCustomerWorkspace
    ? showAllCustomerPosts
      ? "Browse, review, and manage articles from every author."
      : "View, edit, and track the status of articles you have written."
    : "Create, publish, and manage storefront blog articles.";
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BlogStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  useEffect(() => {
    const status = searchParams.get("status");
    if (
      status === "draft" ||
      status === "pending" ||
      status === "published" ||
      status === "rejected"
    ) {
      setStatusFilter(status);
      setPage(1);
    }
  }, [searchParams]);

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: search || undefined,
      status: statusFilter || undefined,
      categoryId: categoryFilter || undefined,
    }),
    [page, search, statusFilter, categoryFilter],
  );

  const categoriesQuery = useQuery({
    queryKey: queryKeys.admin.blogCategory.list(),
    queryFn: listAdminBlogCategories,
    enabled: canViewBlog,
    staleTime: 60_000,
  });

  const blogsQuery = useQuery({
    queryKey: queryKeys.admin.blog.list(filters),
    queryFn: () => getAdminBlogs(filters),
    placeholderData: keepPreviousData,
    enabled: canViewBlog,
    staleTime: 30_000,
  });

  const invalidateBlogs = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.blog.all });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBlog(id),
    onSuccess: async () => {
      await invalidateBlogs();
      adminToast("Blog post deleted.", true);
    },
    onError: (err) => {
      adminToast(err instanceof Error ? err.message : "Could not delete post.", false);
    },
    onSettled: () => setDeletingId(null),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveBlog(id),
    onSuccess: async (post) => {
      await invalidateBlogs();
      await queryClient.invalidateQueries({ queryKey: queryKeys.blog.all });
      adminToast(`"${post.title}" approved and published.`, true);
    },
    onError: (err) => {
      adminToast(
        err instanceof Error ? err.message : "Could not approve post.",
        false,
      );
    },
    onSettled: () => setStatusBusyId(null),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectBlog(id, reason),
    onSuccess: async (post) => {
      await invalidateBlogs();
      adminToast(`"${post.title}" rejected.`, true);
    },
    onError: (err) => {
      adminToast(
        err instanceof Error ? err.message : "Could not reject post.",
        false,
      );
    },
    onSettled: () => setStatusBusyId(null),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BlogStatus }) =>
      changeBlogStatus(id, status),
    onSuccess: async (post) => {
      await invalidateBlogs();
      adminToast(
        post.status === "published"
          ? `"${post.title}" published.`
          : `"${post.title}" moved to draft.`,
        true,
      );
    },
    onError: (err) => {
      adminToast(
        err instanceof Error ? err.message : "Could not update status.",
        false,
      );
    },
    onSettled: () => setStatusBusyId(null),
  });

  const items = useMemo(
    () => blogsQuery.data?.items ?? [],
    [blogsQuery.data?.items],
  );
  const total = blogsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = blogsQuery.isPending;
  const loadError = blogsQuery.isError ? "Could not load blog posts." : null;

  const stats = useMemo(() => {
    let published = 0;
    let pending = 0;
    let draft = 0;
    for (const item of items) {
      if (item.status === "published") published += 1;
      else if (item.status === "pending") pending += 1;
      else draft += 1;
    }
    return { total, published, pending, draft, inView: items.length };
  }, [items, total]);

  const overviewItems = useMemo<BlogOverviewItem[]>(
    () => [
      {
        key: "total",
        tone: "brand",
        icon: <FileIcon className="h-4 w-4" />,
        label: showAllCustomerPosts ? "Total posts" : "My Posts",
        value: loading ? "…" : String(stats.total),
        meta: showAllCustomerPosts
          ? "All articles in workspace"
          : "Articles you authored",
      },
      {
        key: "pending",
        tone: "amber",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Pending review",
        value: loading ? "…" : String(stats.pending),
        meta: showAllCustomerPosts
          ? "Awaiting admin approval"
          : "Waiting for admin approval",
      },
      {
        key: "published",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Published",
        value: loading ? "…" : String(stats.published),
        meta: "Live on storefront",
      },
      {
        key: "page",
        tone: "muted",
        icon: <GridIcon className="h-4 w-4" />,
        label: "This page",
        value: loading ? "…" : String(stats.inView),
        meta: "Current results",
      },
    ],
    [showAllCustomerPosts, loading, stats],
  );

  function applyFilters() {
    setSearch(searchDraft.trim());
    setPage(1);
  }

  async function onDelete(item: BlogListItem) {
    if (
      !confirm(`Delete "${item.title}"? This cannot be undone.`)
    ) {
      return;
    }
    hideAdminToast();
    setDeletingId(item.id);
    deleteMutation.mutate(item.id);
  }

  async function onToggleStatus(item: BlogListItem) {
    if (!canPublishBlog) return;
    hideAdminToast();
    const next: BlogStatus =
      item.status === "published" ? "draft" : "published";
    setStatusBusyId(item.id);
    statusMutation.mutate({ id: item.id, status: next });
  }

  async function onApprove(item: BlogListItem) {
    hideAdminToast();
    setStatusBusyId(item.id);
    approveMutation.mutate(item.id);
  }

  async function onReject(item: BlogListItem) {
    const reason = prompt(
      `Reject "${item.title}"? Optional reason for the author:`,
      "",
    );
    if (reason === null) return;
    hideAdminToast();
    setStatusBusyId(item.id);
    rejectMutation.mutate({
      id: item.id,
      reason: reason.trim() || undefined,
    });
  }

  const createAction =
    canEditBlog ? (
      <Link
        href={
          isCustomerWorkspace
            ? "/dashboard/blogs/create"
            : "/admin/blogs/create"
        }
        className="btn-primary btn-primary-sm"
      >
        + Create Post
      </Link>
    ) : undefined;

  const layoutCommon = {
    isCustomerWorkspace,
    title: pageTitle,
    description: pageDescription,
    backHref: isCustomerWorkspace ? "/dashboard" : blogPaths.overview,
    backLabel: isCustomerWorkspace ? "Dashboard" : "Blog overview",
    action: createAction,
  };

  if (permsLoading) {
    return (
      <BlogFormPageLayout
        {...layoutCommon}
        loading
        loadingText="Checking access…"
      />
    );
  }

  if (!canViewBlog) {
    return (
      <BlogFormPageLayout {...layoutCommon}>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          You do not have permission to view blog posts.
        </div>
      </BlogFormPageLayout>
    );
  }

  const emptyMessage =
    !isCustomerWorkspace || showAllCustomerPosts
      ? "No blog posts match your filters."
      : "You have not written any blog posts yet. Create your first article to get started.";

  const listCard = (
    <AdminOrderListCard
      icon={<LinkIcon className="h-4 w-4" />}
      title={postsListTitle}
      subtitle={
        isCustomerWorkspace
          ? showAllCustomerPosts
            ? `${total} post${total === 1 ? "" : "s"} total`
            : `${total} post${total === 1 ? "" : "s"} written by you`
          : `${total} post${total === 1 ? "" : "s"} total`
      }
      className={
        isCustomerWorkspace
          ? `${CONTACT_EMAIL_CARD_CLASS} blog-form-customer-card`
          : undefined
      }
    >
      <div className="blog-workspace-posts-toolbar admin-blogs-posts-toolbar mb-4">
        <div className="min-w-0">
          <label htmlFor="blogs-search" className={labelCls}>
            Search
          </label>
          <input
            id="blogs-search"
            type="search"
            className="admin-input admin-email-logs-search-input w-full"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Title, excerpt, content…"
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="blogs-status" className={labelCls}>
            Status
          </label>
          <AdminSelect
            id="blogs-status"
            className="admin-email-logs-status-select w-full min-w-0"
            value={statusFilter}
            onChange={(value) => {
              if (value === "" || isBlogStatus(value)) {
                setStatusFilter(value);
              }
              setPage(1);
            }}
            options={[
              { value: "", label: "All statuses" },
              { value: "pending", label: "Pending review" },
              { value: "draft", label: "Draft" },
              { value: "published", label: "Published" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="blogs-category" className={labelCls}>
            Category
          </label>
          <AdminSelect
            id="blogs-category"
            className="admin-email-logs-status-select w-full min-w-0"
            value={categoryFilter}
            onChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}
            options={[
              { value: "", label: "All categories" },
              ...(categoriesQuery.data ?? []).map((c) => ({
                value: c.id,
                label: c.name,
              })),
            ]}
          />
        </div>
        <button
          type="button"
          className="panel-3d-btn admin-email-logs-search-btn inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          onClick={applyFilters}
        >
          <SearchIcon className="h-4 w-4" aria-hidden />
          Apply
        </button>
      </div>

      {loading && items.length === 0 ? (
        <p className="dashboard-pro-empty py-10 text-sm text-subtle">
          Loading blog posts…
        </p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="blog-workspace-posts-empty">
          <span className="blog-workspace-posts-empty__icon" aria-hidden>
            <FileIcon className="h-5 w-5" />
          </span>
          <p>{emptyMessage}</p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="blog-workspace-posts-list admin-blogs-posts-mobile lg:hidden">
          {items.map((item) => {
            const busy =
              deletingId === item.id || statusBusyId === item.id;
            return (
              <li key={item.id}>
                <BlogPostMobileCard
                  item={item}
                  editHref={blogEditHref(isCustomerWorkspace, item.id)}
                  busy={busy}
                  canEditBlog={canEditBlog}
                  canPublishBlog={canPublishBlog}
                  canDeleteBlog={canDeleteBlog}
                  onApprove={onApprove}
                  onReject={onReject}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <div className="admin-site-menus-table-wrap admin-blogs-posts-table hidden overflow-x-auto lg:block">
          <table className="admin-site-menus-table w-full min-w-[960px] text-sm">
            <thead>
              <tr>
                <th>Image</th>
                <th>Title</th>
                <th>Category</th>
                <th>Author</th>
                <th>Status</th>
                <th>Views</th>
                <th>Created</th>
                <th className="admin-site-menus-table-sticky-actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const thumb = resolveMediaSrc(item.featuredImage ?? "");
                const author = formatBlogAuthorName(item.author, "—");
                const busy =
                  deletingId === item.id || statusBusyId === item.id;
                return (
                  <tr key={item.id}>
                    <td>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="blog-admin-list-thumb rounded-md object-cover"
                        />
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td>
                      <div className="font-medium text-foreground">
                        {item.title}
                      </div>
                      <div className="text-xs text-subtle">/{item.slug}</div>
                    </td>
                    <td>{item.category || "—"}</td>
                    <td>{author}</td>
                    <td>
                      <span className={blogStatusBadgeClass(item.status)}>
                        {blogStatusLabel(item.status)}
                      </span>
                    </td>
                    <td>{item.views.toLocaleString()}</td>
                    <td>{formatAdminBlogDate(item.createdAt)}</td>
                    <td className="admin-site-menus-table-sticky-actions">
                      <div className="flex flex-wrap gap-2">
                        <BlogPostActions
                          item={item}
                          editHref={blogEditHref(isCustomerWorkspace, item.id)}
                          busy={busy}
                          canEditBlog={canEditBlog}
                          canPublishBlog={canPublishBlog}
                          canDeleteBlog={canDeleteBlog}
                          variant="table"
                          onApprove={onApprove}
                          onReject={onReject}
                          onToggleStatus={onToggleStatus}
                          onDelete={onDelete}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {totalPages > 1 ? (
        <nav
          className="blog-workspace-posts-pagination"
          aria-label="Blog list pagination"
        >
          <button
            type="button"
            className="btn-secondary btn-secondary-sm"
            disabled={page <= 1 || blogsQuery.isFetching}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <span className="blog-workspace-posts-pagination__label">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary btn-secondary-sm"
            disabled={page >= totalPages || blogsQuery.isFetching}
            onClick={() =>
              setPage((value) => Math.min(totalPages, value + 1))
            }
          >
            Next
          </button>
        </nav>
      ) : null}
    </AdminOrderListCard>
  );

  return (
    <BlogFormPageLayout {...layoutCommon}>
      <div
        className={
          isCustomerWorkspace
            ? "blog-workspace-posts-page space-y-5"
            : "admin-blogs-posts-page space-y-5"
        }
      >
      {loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {loadError}
        </div>
      ) : null}

      <BlogOverviewStats items={overviewItems} />
      {listCard}
      </div>
    </BlogFormPageLayout>
  );
}
