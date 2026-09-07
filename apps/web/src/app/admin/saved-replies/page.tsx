"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderPageIntro,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import type { AdminQuickLink } from "@/components/admin/admin-quick-links";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CheckIcon,
  MailIcon,
  PulseIcon,
  TagIcon,
} from "@/components/admin/icons";
import {
  SavedReplyFormPanel,
  type SavedReplyFormValues,
} from "@/components/admin/saved-reply-form-panel";
import {
  getChatQuickReplies,
  updateChatQuickReplies,
  type ChatQuickReply,
} from "@/lib/api";
import { hasStrictAdminRole } from "@/lib/auth-roles";

const PAGE_SIZE = 10;

const SAVED_REPLIES_QUICK_LINKS: readonly AdminQuickLink[] = [
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/chat", label: "Live chat" },
  { href: "/admin/chat/settings", label: "Live chat settings" },
  { href: "/admin/chat/status", label: "System status" },
  { href: "/admin/saved-replies", label: "Saved replies" },
];

const EMPTY_FORM: SavedReplyFormValues = {
  label: "",
  category: "",
  body: "",
  enabled: true,
};

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function newQuickReplyId(): string {
  return `qr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeReplies(items: ChatQuickReply[]): ChatQuickReply[] {
  return items.map((item, index) => ({
    id: item.id,
    label: item.label.trim(),
    category: (item.category ?? "").trim(),
    body: item.body.trim(),
    enabled: item.enabled !== false,
    sortOrder: index,
  }));
}

function replyToForm(reply: ChatQuickReply): SavedReplyFormValues {
  return {
    label: reply.label,
    category: reply.category ?? "",
    body: reply.body,
    enabled: reply.enabled !== false,
  };
}

function countReplyStats(replies: ChatQuickReply[]) {
  let enabled = 0;
  let disabled = 0;
  const categories = new Set<string>();
  for (const reply of replies) {
    if (reply.enabled) enabled += 1;
    else disabled += 1;
    const cat = (reply.category ?? "").trim();
    if (cat) categories.add(cat);
  }
  return {
    total: replies.length,
    enabled,
    disabled,
    categoryCount: categories.size,
  };
}

type SavedReplyStatTone = "brand" | "success" | "amber" | "muted";

type SavedReplyOverviewItem = {
  key: string;
  tone: SavedReplyStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function SavedReplyOverviewStats({
  items,
}: {
  items: SavedReplyOverviewItem[];
}) {
  return (
    <section
      className="customer-dashboard-overview-section admin-saved-replies-overview"
      aria-label="Saved reply overview"
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

export default function AdminSavedRepliesPage() {
  const [allowed, setAllowed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [replies, setReplies] = useState<ChatQuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<SavedReplyFormValues>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setAllowed(hasStrictAdminRole());
      setAuthChecked(true);
    };
    sync();
    window.addEventListener("auth-change", sync);
    return () => window.removeEventListener("auth-change", sync);
  }, []);

  const load = useCallback(() => {
    if (!hasStrictAdminRole()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    getChatQuickReplies()
      .then((result) => setReplies(result.quickReplies ?? []))
      .catch((err) => {
        setReplies([]);
        setLoadError(
          err instanceof Error ? err.message : "Failed to load saved replies",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (allowed) load();
    else setLoading(false);
  }, [authChecked, allowed, load]);

  const stats = useMemo(() => countReplyStats(replies), [replies]);

  const overviewItems = useMemo<SavedReplyOverviewItem[]>(
    () => [
      {
        key: "total",
        tone: "brand",
        icon: <MailIcon className="h-4 w-4" />,
        label: "Total replies",
        value: loading ? "…" : String(stats.total),
        meta: "All templates",
      },
      {
        key: "enabled",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Enabled",
        value: loading ? "…" : String(stats.enabled),
        meta: "Available to staff",
      },
      {
        key: "disabled",
        tone: "amber",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Disabled",
        value: loading ? "…" : String(stats.disabled),
        meta: "Hidden from picker",
      },
      {
        key: "categories",
        tone: "muted",
        icon: <TagIcon className="h-4 w-4" />,
        label: "Categories",
        value: loading ? "…" : String(stats.categoryCount),
        meta: "Unique group labels",
      },
    ],
    [loading, stats],
  );

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    for (const reply of replies) {
      const cat = (reply.category ?? "").trim();
      if (cat) cats.add(cat);
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [replies]);

  const filteredReplies = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    return replies
      .filter((reply) => {
        if (categoryFilter !== "all") {
          const cat = (reply.category ?? "").trim();
          if (cat !== categoryFilter) return false;
        }
        if (!q) return true;
        const haystack = [
          reply.label,
          reply.category ?? "",
          reply.body,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  }, [appliedSearch, categoryFilter, replies]);

  const listTotal = filteredReplies.length;
  const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart =
    listTotal === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, listTotal);
  const pagedReplies = filteredReplies.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const filtersActive =
    appliedSearch.trim().length > 0 || categoryFilter !== "all";

  useEffect(() => {
    setPage(1);
  }, [appliedSearch, categoryFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function setFormField(patch: Partial<SavedReplyFormValues>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function applyFilters() {
    setAppliedSearch(draftSearch);
  }

  function clearFilters() {
    setDraftSearch("");
    setAppliedSearch("");
    setCategoryFilter("all");
  }

  function startEdit(reply: ChatQuickReply) {
    setEditingId(reply.id);
    setForm(replyToForm(reply));
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function persistReplies(
    next: ChatQuickReply[],
    successMessage: string,
  ): Promise<boolean> {
    hideAdminToast();
    const payload = normalizeReplies(next);
    const result = await updateChatQuickReplies(payload);
    setReplies(result.quickReplies ?? payload);
    adminToast(successMessage, true);
    return true;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!allowed) return;
    setFormError(null);
    setSaving(true);
    hideAdminToast();
    try {
      const label = form.label.trim();
      const body = form.body.trim();
      const category = form.category.trim();
      if (!label || !body) {
        setFormError("Label and message are required.");
        return;
      }

      let next: ChatQuickReply[];
      if (editingId) {
        next = replies.map((reply) =>
          reply.id === editingId
            ? {
                ...reply,
                label,
                category,
                body,
                enabled: form.enabled,
              }
            : reply,
        );
        await persistReplies(next, "Saved reply updated.");
        cancelEdit();
      } else {
        const item: ChatQuickReply = {
          id: newQuickReplyId(),
          label,
          category,
          body,
          enabled: form.enabled,
          sortOrder: replies.length,
        };
        next = [...replies, item];
        await persistReplies(next, "Saved reply created.");
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Save failed";
      setFormError(message);
      adminToast(message, false);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string, label: string) {
    if (!confirm(`Delete saved reply "${label}"?`)) return;
    setDeletingId(id);
    hideAdminToast();
    try {
      const next = replies.filter((reply) => reply.id !== id);
      await persistReplies(next, "Saved reply deleted.");
      if (editingId === id) cancelEdit();
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Delete failed",
        false,
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (!authChecked) {
    return (
      <AdminPageLayout
        section="Support"
        title="Saved replies"
        description="Manage reusable live chat message templates."
        icon={MailIcon}
        backHref="/admin/chat"
        backLabel="Live chat"
      >
        <div className="panel-3d-empty px-6 py-12">
          <p className="text-sm text-subtle">Checking access…</p>
        </div>
      </AdminPageLayout>
    );
  }

  if (!allowed) {
    return (
      <AdminPageLayout
        section="Support"
        title="Saved replies"
        description="Manage reusable live chat message templates."
        icon={MailIcon}
        backHref="/admin/chat"
        backLabel="Live chat"
      >
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Admin access required. Saved replies can only be managed by admin
          accounts.
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      section="Support"
      title="Saved replies"
      description="Create and organize reusable messages for live chat staff."
      icon={MailIcon}
      backHref="/admin/chat"
      backLabel="Live chat"
    >
      {loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {loadError}
          <button
            type="button"
            onClick={load}
            className="ml-3 text-brand underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <AdminOrderPageIntro
        icon={<MailIcon className="h-4 w-4" />}
        title="Saved replies"
        subtitle="Create, categorize, and maintain quick messages for support staff in live chat."
        quickLinks={SAVED_REPLIES_QUICK_LINKS}
        quickNavLabel="Support shortcuts"
      />

      <AdminOrderTwoColumnLayout
        main={
          <AdminOrderListCard
            icon={<MailIcon className="h-4 w-4" />}
            title="Reply library"
            subtitle={
              loading
                ? "Loading saved replies…"
                : filtersActive
                  ? `${listTotal} repl${listTotal === 1 ? "y" : "ies"} matching filters`
                  : `${listTotal} saved repl${listTotal === 1 ? "y" : "ies"}`
            }
          >
            <SavedReplyOverviewStats items={overviewItems} />

            <div className="flex w-full flex-col gap-4 border-b border-border-strong/40 pb-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[10rem] shrink-0">
                  <label htmlFor="saved-replies-category" className={labelCls}>
                    Category
                  </label>
                  <AdminSelect
                    id="saved-replies-category"
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    className="w-full min-w-[10rem]"
                    options={[
                      { value: "all", label: "All categories" },
                      ...categoryOptions.map((cat) => ({
                        value: cat,
                        label: cat,
                      })),
                    ]}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <label htmlFor="saved-replies-search" className={labelCls}>
                    Search
                  </label>
                  <input
                    id="saved-replies-search"
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    placeholder="Search label, category, or message"
                    className={inputCls}
                  />
                </div>

                {filtersActive ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="dashboard-pro-btn-ghost shrink-0 px-4 py-2 text-sm"
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={applyFilters}
                  className="btn-primary btn-primary-sm shrink-0 px-4 py-2 text-sm"
                >
                  Apply search
                </button>
              </div>

              {filtersActive ? (
                <span className="panel-3d-badge-amber inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Filters active
                </span>
              ) : null}
            </div>

            <div className="panel-3d-table-wrap overflow-x-auto">
              {loading ? (
                <div className="panel-3d-empty px-6 py-12">
                  <p className="text-sm text-subtle">Loading saved replies…</p>
                </div>
              ) : pagedReplies.length === 0 ? (
                <div className="panel-3d-empty px-6 py-12">
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <MailIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    No saved replies found
                  </p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {replies.length === 0
                      ? "Create your first reply using the form."
                      : "Try another category or clear your search."}
                  </p>
                </div>
              ) : (
                <table className="panel-3d-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Category</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedReplies.map((reply) => {
                      const isEditing = editingId === reply.id;
                      const statusClass = reply.enabled
                        ? "dashboard-pro-status dashboard-pro-status--green"
                        : "dashboard-pro-status border border-border/48 bg-muted/30 text-foreground-muted";
                      const preview =
                        reply.body.length > 120
                          ? `${reply.body.slice(0, 120)}…`
                          : reply.body;

                      return (
                        <tr
                          key={reply.id}
                          className={isEditing ? "bg-brand/5" : undefined}
                        >
                          <td className="font-semibold text-brand">
                            {reply.label}
                          </td>
                          <td className="text-foreground-muted">
                            {(reply.category ?? "").trim() || "—"}
                          </td>
                          <td className="max-w-xs text-foreground-muted">
                            <span className="line-clamp-2">{preview}</span>
                          </td>
                          <td>
                            <span className={statusClass}>
                              {reply.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(reply)}
                                className="dashboard-pro-btn-ghost px-3 py-1.5 text-xs"
                              >
                                {isEditing ? "Editing" : "Edit"}
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === reply.id}
                                onClick={() => onDelete(reply.id, reply.label)}
                                className="dashboard-pro-btn-ghost px-3 py-1.5 text-xs text-rose-300 disabled:opacity-50"
                              >
                                {deletingId === reply.id ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && listTotal > PAGE_SIZE ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-strong/40 px-4 py-3">
                <p className="text-xs text-foreground-muted">
                  Page {safePage} of {totalPages} · {listTotal.toLocaleString()}{" "}
                  repl{listTotal === 1 ? "y" : "ies"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1 || saving}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-foreground-muted">
                    {pageStart}–{pageEnd}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages || saving}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </AdminOrderListCard>
        }
        sidebar={
          <SavedReplyFormPanel
            mode={editingId ? "edit" : "create"}
            form={form}
            saving={saving}
            error={formError}
            onChange={setFormField}
            onSubmit={onSave}
            onCancelEdit={editingId ? cancelEdit : undefined}
          />
        }
      />
    </AdminPageLayout>
  );
}
