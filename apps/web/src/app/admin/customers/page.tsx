"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { PriceText } from "@/components/ui/PriceText";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CheckIcon,
  GridIcon,
  PulseIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/admin/icons";
import { getCustomerDisplayName, getPrimaryRoleLabel } from "@/lib/admin-order-view";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  adminBulkDeleteCustomers,
  adminCreateCustomer,
  adminCreditCustomer,
  adminDeleteCustomer,
  adminGetCustomer,
  adminListCustomers,
  adminResetCustomerPassword,
  adminSaveCustomerNote,
  adminSendCustomerEmail,
  adminUpdateCustomer,
  getAdminCustomerOverview,
  CUSTOMER_ROLE_LABELS,
  CUSTOMER_ROLE_OPTIONS,
  CUSTOMER_ROLES,
  normalizeCustomerRoles,
  type AdminCustomerOverview,
  type AdminCustomerRow,
  type CustomerRole,
  type CustomerStatus,
} from "@/lib/api";

const CUSTOMERS_PAGE_SIZE = 20;

const STATUSES: CustomerStatus[] = [
  "pending",
  "active",
  "suspended",
  "banned",
];

const STATUS_LABELS: Record<CustomerStatus, string> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  banned: "Banned",
};

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function overviewStatClass(
  tone: "brand" | "success" | "amber" | "muted",
  active?: boolean,
) {
  return [
    "customer-dashboard-overview-stat",
    `customer-dashboard-overview-stat--${tone}`,
    "w-full text-left",
    active ? "customer-dashboard-overview-stat--active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function CustomerOverviewStatCopy({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: ReactNode;
}) {
  return (
    <div className="customer-dashboard-overview-stat-copy min-w-0">
      <span className="customer-dashboard-overview-stat-label">{label}</span>
      <span className="customer-dashboard-overview-stat-value">{value}</span>
      <p className="customer-dashboard-overview-stat-meta">{meta}</p>
    </div>
  );
}

type FormMode = "create" | "edit" | null;
type BalanceFilter = "" | "with" | "without";

const emptyForm = {
  email: "",
  password: "",
  phone: "",
  firstName: "",
  lastName: "",
  status: "active" as CustomerStatus,
  emailVerified: false,
  roles: ["customer"] as CustomerRole[],
};

export default function AdminCustomersPage() {
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<AdminCustomerOverview | null>(null);
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "">("");
  const [roleFilter, setRoleFilter] = useState<CustomerRole | "">("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("");
  const [mode, setMode] = useState<FormMode>(null);
  const [selected, setSelected] = useState<AdminCustomerRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
    const editRequestRef = useRef(0);
  const [walletCreditAmount, setWalletCreditAmount] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSubject, setEmailSubject] = useState("Message from UniQbd support");
  const [emailMessage, setEmailMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const role = searchParams.get("role");
    if (role && CUSTOMER_ROLES.includes(role as CustomerRole)) {
      setRoleFilter(role as CustomerRole);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    getAdminCustomerOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, roleFilter, balanceFilter]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      adminListCustomers({
        q: q || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        hasBalance:
          balanceFilter === "with"
            ? true
            : balanceFilter === "without"
              ? false
              : undefined,
        page,
        limit: CUSTOMERS_PAGE_SIZE,
      })
        .then((r) => {
          if (!cancelled) {
            setCustomers(r.items);
            setListTotal(r.total);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCustomers([]);
            setListTotal(0);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, statusFilter, roleFilter, balanceFilter, page]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [q, statusFilter, roleFilter, balanceFilter, page]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    const pageIds = customers.map((c) => c.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  function removeCustomersFromList(ids: Iterable<string>) {
    const removed = new Set(ids);
    if (removed.size === 0) return;
    setCustomers((current) => current.filter((c) => !removed.has(c.id)));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of removed) next.delete(id);
      return next;
    });
    setListTotal((total) => {
      const next = Math.max(0, total - removed.size);
      const maxPage = Math.max(1, Math.ceil(next / CUSTOMERS_PAGE_SIZE));
      if (page > maxPage) {
        setPage(maxPage);
      }
      return next;
    });
    reloadOverview();
  }

  function reloadOverview() {
    getAdminCustomerOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }

  function patchCustomerInList(customer: AdminCustomerRow) {
    setCustomers((current) =>
      current.map((row) => (row.id === customer.id ? customer : row)),
    );
  }

  function resetEditExtras() {
    setWalletCreditAmount("");
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setEmailSubject("Message from UniQbd support");
    setEmailMessage("");
  }

  function openCreate() {
    setMode("create");
    setSelected(null);
    setForm(emptyForm);
    resetEditExtras();
  }

  function openEdit(row: AdminCustomerRow) {
    const requestId = ++editRequestRef.current;
    setMode("edit");
    setSelected(row);
    resetEditExtras();
    setForm({
      email: row.email,
      password: "",
      phone: row.phone ?? "",
      firstName: row.profile?.firstName ?? "",
      lastName: row.profile?.lastName ?? "",
      status: (row.status as CustomerStatus) ?? "active",
      emailVerified: row.emailVerified,
      roles: normalizeCustomerRoles(row.roles ?? ["customer"]),
    });
    setEmailMessage(row.adminNote ?? "");
    adminGetCustomer(row.id)
      .then((customer) => {
        if (editRequestRef.current !== requestId) return;
        setSelected(customer);
        setEmailMessage(customer.adminNote ?? "");
      })
      .catch(() => {});
  }

  function closePanel() {
    editRequestRef.current += 1;
    setMode(null);
    setSelected(null);
    resetEditExtras();
  }

  function toggleRole(role: CustomerRole) {
    setForm((f) => {
      const has = f.roles.includes(role);
      const roles = has
        ? f.roles.filter((r) => r !== role)
        : [...f.roles, role];
      return { ...f, roles: roles.length ? roles : ["customer"] };
    });
  }

  async function onInlineStatusChange(
    customer: AdminCustomerRow,
    status: CustomerStatus,
  ) {
    if (status === customer.status) return;
    setStatusUpdatingId(customer.id);
    hideAdminToast();
    try {
      const updated = await adminUpdateCustomer(customer.id, { status });
      patchCustomerInList(updated);
      if (selected?.id === customer.id) {
        setSelected(updated);
        setForm((f) => ({ ...f, status }));
      }
      reloadOverview();
      adminToast(`Status updated to ${STATUS_LABELS[status]}.`, true);
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Status update failed",
        false,
      );
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function onSave() {
    setBusy(true);
    hideAdminToast();
    try {
      if (mode === "create") {
        if (!form.email.trim()) {
          adminToast("Email is required.", false);
          return;
        }
        const created = await adminCreateCustomer({
          email: form.email.trim(),
          password: form.password.trim() || undefined,
          phone: form.phone.trim() || undefined,
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          status: form.status,
          emailVerified: form.emailVerified,
          roles: form.roles,
        });
        setListTotal((total) => total + 1);
        if (page === 1) {
          setCustomers((current) =>
            [created, ...current].slice(0, CUSTOMERS_PAGE_SIZE),
          );
        }
        adminToast("Customer created.", true);
      } else if (mode === "edit" && selected) {
        if (newPassword || confirmPassword) {
          if (newPassword.length < 6) {
            adminToast("Password must be at least 6 characters.", false);
            return;
          }
          if (newPassword !== confirmPassword) {
            adminToast("Passwords do not match.", false);
            return;
          }
          await adminResetCustomerPassword(selected.id, newPassword);
        }

        const creditAmount = Number(walletCreditAmount);
        const credited =
          Number.isFinite(creditAmount) && creditAmount > 0;
        if (credited) {
          await adminCreditCustomer(
            selected.id,
            creditAmount,
            "Admin wallet credit",
          );
        }

        let updated = await adminUpdateCustomer(selected.id, {
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          status: form.status,
          emailVerified: form.emailVerified,
          roles: form.roles,
        });
        if (credited) {
          updated = await adminGetCustomer(selected.id);
        }
        patchCustomerInList(updated);
        adminToast("Customer updated.", true);
      }
      closePanel();
      reloadOverview();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveNote() {
    if (!selected) return;
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await adminSaveCustomerNote(
        selected.id,
        emailMessage.trim(),
      );
      setSelected(updated);
      adminToast("Note saved.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not save note", false);
    } finally {
      setBusy(false);
    }
  }

  async function onSendEmail() {
    if (!selected) return;
    if (!emailSubject.trim() || !emailMessage.trim()) {
      adminToast("Email subject and message are required.", false);
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      await adminSendCustomerEmail(
        selected.id,
        emailSubject.trim(),
        emailMessage.trim(),
      );
      adminToast("Email sent.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not send email", false);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveAndSend() {
    if (!selected) return;
    if (!emailSubject.trim() || !emailMessage.trim()) {
      adminToast("Email subject and message are required.", false);
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await adminSaveCustomerNote(
        selected.id,
        emailMessage.trim(),
      );
      setSelected(updated);
      await adminSendCustomerEmail(
        selected.id,
        emailSubject.trim(),
        emailMessage.trim(),
      );
      adminToast("Note saved and email sent.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not save and send email", false);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(row: AdminCustomerRow) {
    if (
      !confirm(
        `Delete ${row.email}? Users with orders will be soft-banned instead of removed.`,
      )
    ) {
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      const res = await adminDeleteCustomer(row.id);
      adminToast(res.soft
          ? "Customer soft-deleted (has orders)."
          : "Customer permanently deleted.", true);
      if (selected?.id === row.id) closePanel();
      removeCustomersFromList([row.id]);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Delete failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function onBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !confirm(
        `Delete ${ids.length} selected customer${ids.length === 1 ? "" : "s"}?\n\nAccounts with orders will be soft-banned instead of permanently removed.`,
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    hideAdminToast();
    try {
      const res = await adminBulkDeleteCustomers(ids);
      const removedIds = ids.filter(
        (id) => !res.errors.some((row) => row.id === id),
      );
      if (selected && removedIds.includes(selected.id)) closePanel();
      removeCustomersFromList(removedIds);

      const parts: string[] = [];
      if (res.hardDeleted > 0) {
        parts.push(`${res.hardDeleted} permanently deleted`);
      }
      if (res.softDeleted > 0) {
        parts.push(`${res.softDeleted} soft-deleted (has orders)`);
      }
      if (res.failed > 0) {
        parts.push(`${res.failed} failed`);
      }

      adminToast(
        parts.length > 0 ? parts.join(" · ") : "No customers were deleted.",
        res.failed === 0,
      );

      if (res.errors.length > 0 && res.errors.length <= 3) {
        for (const row of res.errors) {
          adminToast(row.message, false);
        }
      } else if (res.errors.length > 3) {
        adminToast(`${res.errors.length} deletions failed. Check server logs.`, false);
      }
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Bulk delete failed.", false);
    } finally {
      setBulkDeleting(false);
    }
  }

  const filtersActive = Boolean(
    q || statusFilter || roleFilter || balanceFilter,
  );
  const totalPages = Math.max(1, Math.ceil(listTotal / CUSTOMERS_PAGE_SIZE));
  const pageStart =
    listTotal === 0 ? 0 : (page - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const pageEnd = Math.min(page * CUSTOMERS_PAGE_SIZE, listTotal);
  const allOnPageSelected =
    customers.length > 0 && customers.every((c) => selectedIds.has(c.id));
  const pageActionBusy = busy || bulkDeleting;

  return (
    <AdminPageLayout
      section="Customers"
      title="All customers"
      description="Search, filter, and manage registered users — create accounts, edit profiles, wallet credits, and support notes."
      icon={UsersIcon}
      backHref="/admin"
      backLabel="Dashboard"
      action={
        <button type="button" onClick={openCreate} className="btn-primary">
          + Add customer
        </button>
      }
    >

      <div className="admin-customers-page-full min-w-0 space-y-5">
      <AdminOrderListCard
        icon={<UsersIcon className="h-4 w-4" />}
        title="Customer list"
        subtitle={
          loading
            ? "Loading customers…"
            : listTotal > 0
              ? `Showing ${pageStart}–${pageEnd} of ${listTotal.toLocaleString()} customer${listTotal === 1 ? "" : "s"}`
              : "No customers match your filters"
        }
        className="admin-customers-catalog"
      >
            {overview ? (
              <section
                className="customer-dashboard-overview-section admin-customers-overview"
                aria-label="Customer overview"
              >
                <div className="customer-dashboard-overview-stats">
                  <div
                    className={`${overviewStatClass("brand")} cursor-default`}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <UsersIcon className="h-4 w-4" />
                    </span>
                    <CustomerOverviewStatCopy
                      label="Total customers"
                      value={overview.total.toLocaleString()}
                      meta="Registered accounts"
                    />
                  </div>

                  <button
                    type="button"
                    aria-pressed={statusFilter === "active"}
                    onClick={() =>
                      setStatusFilter(statusFilter === "active" ? "" : "active")
                    }
                    className={overviewStatClass("success", statusFilter === "active")}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <CustomerOverviewStatCopy
                      label="Active"
                      value={overview.active.toLocaleString()}
                      meta="Verified & enabled"
                    />
                  </button>

                  <button
                    type="button"
                    aria-pressed={statusFilter === "pending"}
                    onClick={() =>
                      setStatusFilter(statusFilter === "pending" ? "" : "pending")
                    }
                    className={overviewStatClass("amber", statusFilter === "pending")}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <PulseIcon className="h-4 w-4" />
                    </span>
                    <CustomerOverviewStatCopy
                      label="Pending"
                      value={overview.pending.toLocaleString()}
                      meta="Awaiting verification"
                    />
                  </button>

                  <button
                    type="button"
                    aria-pressed={balanceFilter === "with"}
                    onClick={() =>
                      setBalanceFilter(balanceFilter === "with" ? "" : "with")
                    }
                    className={overviewStatClass("amber", balanceFilter === "with")}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <WalletIcon className="h-4 w-4" />
                    </span>
                    <CustomerOverviewStatCopy
                      label="With balance"
                      value={overview.withBalance.toLocaleString()}
                      meta={
                        <>
                          <PriceText
                            amount={overview.walletTotal}
                            currency="BDT"
                          />{" "}
                          total wallet
                        </>
                      }
                    />
                  </button>

                  <button
                    type="button"
                    aria-pressed={statusFilter === "banned"}
                    onClick={() =>
                      setStatusFilter(statusFilter === "banned" ? "" : "banned")
                    }
                    className={overviewStatClass("muted", statusFilter === "banned")}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <ShieldIcon className="h-4 w-4" />
                    </span>
                    <CustomerOverviewStatCopy
                      label="Banned"
                      value={overview.banned.toLocaleString()}
                      meta="Blocked from storefront"
                    />
                  </button>

                  <div
                    className={`${overviewStatClass("muted")} cursor-default`}
                  >
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <GridIcon className="h-4 w-4" />
                    </span>
                    <CustomerOverviewStatCopy
                      label="Joined today"
                      value={overview.today.toLocaleString()}
                      meta="New registrations"
                    />
                  </div>
                </div>
              </section>
            ) : null}

            <CustomerFilters
              q={q}
              statusFilter={statusFilter}
              roleFilter={roleFilter}
              balanceFilter={balanceFilter}
              loading={loading}
              filtersActive={filtersActive}
              onQChange={setQ}
              onStatusChange={setStatusFilter}
              onRoleChange={setRoleFilter}
              onBalanceChange={setBalanceFilter}
              onClear={() => {
                setQ("");
                setStatusFilter("");
                setRoleFilter("");
                setBalanceFilter("");
              }}
            />

            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2.5">
                <p className="text-sm text-rose-100/90">
                  <span className="font-semibold text-rose-50">
                    {selectedIds.size}
                  </span>{" "}
                  customer{selectedIds.size === 1 ? "" : "s"} selected
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost text-xs"
                    disabled={pageActionBusy}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-500/45 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
                    disabled={pageActionBusy}
                    onClick={() => void onBulkDelete()}
                  >
                    {bulkDeleting ? "Deleting…" : "Delete selected"}
                  </button>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="admin-products-table-empty">
                Loading customers…
              </div>
            ) : customers.length === 0 ? (
              <div className="dashboard-pro-empty px-4 py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <UsersIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  No customers found
                </p>
                <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                  {filtersActive
                    ? "Try clearing filters or adjusting your search."
                    : "Create a customer to get started."}
                </p>
              </div>
            ) : (
              <div className="admin-products-table-wrap admin-customers-table-wrap panel-3d-table-wrap overflow-x-auto">
                <table className="panel-3d-table admin-customers-table w-full">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all customers on this page"
                          checked={allOnPageSelected}
                          disabled={pageActionBusy || customers.length === 0}
                          onChange={toggleSelectAllOnPage}
                          className="h-4 w-4 rounded border-border accent-brand"
                        />
                      </th>
                      <th>Customer</th>
                      <th>Roles</th>
                      <th>Status</th>
                      <th>Verified</th>
                      <th>Balance</th>
                      <th>Joined</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => {
                      const roleSubtitle = getPrimaryRoleLabel(c.roles);
                      return (
                      <tr key={c.id}>
                        <td data-label="Select" className="align-middle">
                          <input
                            type="checkbox"
                            aria-label={`Select ${c.email}`}
                            checked={selectedIds.has(c.id)}
                            disabled={pageActionBusy}
                            onChange={() => toggleSelected(c.id)}
                            className="h-4 w-4 rounded border-border accent-brand"
                          />
                        </td>
                        <td data-label="Customer">
                          <p className="font-medium text-foreground">
                            {getCustomerDisplayName(c)}
                          </p>
                          <p className="text-xs text-subtle">{c.email}</p>
                          {roleSubtitle ? (
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                              {roleSubtitle}
                            </p>
                          ) : null}
                        </td>
                        <td data-label="Roles" className="text-xs capitalize">
                          {c.roles
                            ?.map((r) => CUSTOMER_ROLE_LABELS[r as CustomerRole] ?? r)
                            .join(", ") ?? "Customer"}
                        </td>
                        <td data-label="Status" className="admin-customers-status-cell">
                          <AdminSelect
                            value={(c.status as CustomerStatus) ?? "active"}
                            onChange={(v) =>
                              void onInlineStatusChange(c, v as CustomerStatus)
                            }
                            disabled={pageActionBusy || statusUpdatingId === c.id}
                            className={`admin-customers-status-select admin-customers-status-select--${c.status}`}
                            options={STATUSES.map((s) => ({
                              value: s,
                              label: STATUS_LABELS[s],
                            }))}
                          />
                        </td>
                        <td data-label="Verified">{c.emailVerified ? "Yes" : "No"}</td>
                        <td
                          data-label="Balance"
                          className={
                            (c.wallet?.balance ?? 0) > 0
                              ? "font-medium text-emerald-300"
                              : "text-foreground-muted"
                          }
                        >
                          <PriceText
                            amount={c.wallet?.balance ?? 0}
                            currency={c.wallet?.currency ?? "BDT"}
                          />
                        </td>
                        <td data-label="Joined" className="text-foreground-muted">
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td data-label="Actions" className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(c)}
                              className="dashboard-pro-btn-ghost text-xs"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(c)}
                              disabled={pageActionBusy}
                              className="dashboard-pro-btn-ghost text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && listTotal > CUSTOMERS_PAGE_SIZE ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-strong/40 px-4 py-3">
                <p className="text-xs text-foreground-muted">
                  Page {page} of {totalPages} ·{" "}
                  {listTotal.toLocaleString()} customer
                  {listTotal === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || busy}
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
                    disabled={page >= totalPages || busy}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
      </AdminOrderListCard>
      </div>

      {mode ? (
        <CustomerDrawer
          title={mode === "create" ? "Add customer" : "Edit customer"}
          onClose={closePanel}
        >
          <ProductFormOrderCard
            className="admin-customers-form !border-0 !bg-transparent !p-0 !shadow-none"
            title={mode === "create" ? "Account details" : "Customer profile"}
            subtitle={
              mode === "create"
                ? "Create a new registered account."
                : selected?.email ?? "Update profile and support tools."
            }
          >
            <div className="space-y-4">
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              {mode === "create" && (
                <Field label="Password (optional)">
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="First name">
                  <input
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Status">
                <AdminSelect
                  value={form.status}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as CustomerStatus,
                    }))
                  }
                  className="w-full"
                  options={STATUSES.map((s) => ({
                    value: s,
                    label: STATUS_LABELS[s],
                  }))}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-foreground-muted">
                <input
                  type="checkbox"
                  checked={form.emailVerified}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      emailVerified: e.target.checked,
                    }))
                  }
                />
                Email verified
              </label>
              <div>
                <p className={labelCls}>Roles</p>
                <p className="mb-3 text-xs text-subtle">
                  Tap to assign — customer is kept if no other role is selected.
                </p>
                <div className="admin-customers-role-grid">
                  {CUSTOMER_ROLE_OPTIONS.map((role) => {
                    const active = form.roles.includes(role.value);
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => toggleRole(role.value)}
                        aria-pressed={active}
                        className={`admin-customers-role-option${active ? " admin-customers-role-option--active" : ""}`}
                      >
                        <span className="admin-customers-role-option-label">
                          {role.label}
                        </span>
                        <span className="admin-customers-role-option-desc">
                          {role.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {mode === "edit" && (
                <>
                  <Field label="Wallet Balance">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={walletCreditAmount}
                      onChange={(e) => setWalletCreditAmount(e.target.value)}
                      placeholder={
                        selected?.wallet
                          ? `Current: ${selected.wallet.balance}`
                          : "0"
                      }
                      className={inputCls}
                    />
                  </Field>

                  <div className="space-y-3 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold uppercase text-subtle">
                      Change password
                    </p>
                    <p className="text-xs text-foreground-muted">
                      Leave blank to keep the current password. Minimum 6
                      characters.
                    </p>
                    <Field label="New password">
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle"
                        >
                          {showNewPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </Field>
                    <Field label="Confirm password">
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle"
                        >
                          {showConfirmPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </Field>
                  </div>

                  <div className="space-y-3 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold uppercase text-subtle">
                      Note &amp; email
                    </p>
                    <Field label="Email subject">
                      <input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Message from UniQbd support"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Message">
                      <textarea
                        rows={4}
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        placeholder="Write a note for this customer..."
                        className={`${inputCls} min-h-[6rem] resize-y`}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={onSaveNote}
                        disabled={busy}
                        className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                      >
                        Save note
                      </button>
                      <button
                        type="button"
                        onClick={onSendEmail}
                        disabled={busy}
                        className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                      >
                        Send email
                      </button>
                      <button
                        type="button"
                        onClick={onSaveAndSend}
                        disabled={busy}
                        className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                      >
                        Save &amp; send
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="btn-primary w-full disabled:opacity-50"
            >
              {busy
                ? "Saving…"
                : mode === "create"
                  ? "Create customer"
                  : "Save changes"}
            </button>
          </ProductFormOrderCard>
        </CustomerDrawer>
      ) : null}
    </AdminPageLayout>
  );
}

function CustomerDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close customer panel"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="admin-customers-modal relative z-10 flex max-h-[min(90vh,52rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/60 bg-elevated shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function CustomerFilters({
  q,
  statusFilter,
  roleFilter,
  balanceFilter,
  loading,
  filtersActive,
  onQChange,
  onStatusChange,
  onRoleChange,
  onBalanceChange,
  onClear,
}: {
  q: string;
  statusFilter: CustomerStatus | "";
  roleFilter: CustomerRole | "";
  balanceFilter: BalanceFilter;
  loading: boolean;
  filtersActive: boolean;
  onQChange: (v: string) => void;
  onStatusChange: (v: CustomerStatus | "") => void;
  onRoleChange: (v: CustomerRole | "") => void;
  onBalanceChange: (v: BalanceFilter) => void;
  onClear: () => void;
}) {
  return (
    <div className="admin-products-filters-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {filtersActive ? (
          <>
            <span className="dashboard-pro-status dashboard-pro-status--amber inline-flex">
              Filters active
            </span>
            <button
              type="button"
              onClick={onClear}
              className="dashboard-pro-btn-ghost shrink-0 text-xs"
            >
              Clear filters
            </button>
          </>
        ) : loading ? (
          <span className="text-xs text-subtle">Updating list…</span>
        ) : null}
      </div>

      <div className="admin-products-filters-row">
        <div className="admin-products-filter-field admin-customers-search-field min-w-0">
          <label htmlFor="customer-search" className="admin-products-filter-label">
            <SearchIcon className="admin-order-view-detail-icon" aria-hidden />
            Search
          </label>
          <input
            id="customer-search"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Email, name or phone…"
            className="admin-input w-full"
          />
        </div>

        <div className="admin-products-filter-field min-w-0">
          <label htmlFor="customer-status" className="admin-products-filter-label">
            Status
          </label>
          <AdminSelect
            id="customer-status"
            value={statusFilter}
            onChange={(v) => onStatusChange(v as CustomerStatus | "")}
            className="w-full"
            options={[
              { value: "", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
            ]}
          />
        </div>

        <div className="admin-products-filter-field min-w-0">
          <label htmlFor="customer-role" className="admin-products-filter-label">
            Role
          </label>
          <AdminSelect
            id="customer-role"
            value={roleFilter}
            onChange={(v) => onRoleChange(v as CustomerRole | "")}
            className="w-full"
            options={[
              { value: "", label: "All roles" },
              ...CUSTOMER_ROLES.map((r) => ({
                value: r,
                label: CUSTOMER_ROLE_LABELS[r],
              })),
            ]}
          />
        </div>

        <div className="admin-products-filter-field min-w-0">
          <label htmlFor="customer-balance" className="admin-products-filter-label">
            Balance
          </label>
          <AdminSelect
            id="customer-balance"
            value={balanceFilter}
            onChange={(v) => onBalanceChange(v as BalanceFilter)}
            className="w-full"
            options={[
              { value: "", label: "All balances" },
              { value: "with", label: "Has balance" },
              { value: "without", label: "No balance" },
            ]}
          />
        </div>
      </div>

      {filtersActive ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
            Active
          </span>
          {q ? (
            <span className="dashboard-pro-status dashboard-pro-status--brand">
              Search: {q.length > 24 ? `${q.slice(0, 24)}…` : q}
            </span>
          ) : null}
          {statusFilter ? (
            <span className="dashboard-pro-status dashboard-pro-status--green capitalize">
              Status: {statusFilter}
            </span>
          ) : null}
          {roleFilter ? (
            <span className="dashboard-pro-status dashboard-pro-status--brand capitalize">
              Role: {CUSTOMER_ROLE_LABELS[roleFilter]}
            </span>
          ) : null}
          {balanceFilter ? (
            <span className="dashboard-pro-status dashboard-pro-status--amber">
              Balance:{" "}
              {balanceFilter === "with" ? "Has balance" : "No balance"}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
