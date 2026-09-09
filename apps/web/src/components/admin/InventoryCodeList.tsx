"use client";

import { SearchIcon } from "@/components/admin/icons";
import { adminToast } from "@/lib/admin-toast";
import {
  deleteInventoryCode,
  listInventoryCodes,
  updateInventoryCode,
  type InventoryCodeItem,
  type InventoryCodeStatus,
} from "@/lib/api";
import { useCallback, useEffect, useId, useState } from "react";

const inputCls = "admin-input w-full text-sm";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

const STATUS_LABEL: Record<InventoryCodeStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  disabled: "Disabled",
};

const STATUS_TABS: Array<{
  value: "" | InventoryCodeStatus;
  label: string;
  countKey?: "available" | "reserved" | "sold";
}> = [
  { value: "available", label: "Available", countKey: "available" },
  { value: "reserved", label: "Reserved", countKey: "reserved" },
  { value: "sold", label: "Sold", countKey: "sold" },
  { value: "", label: "All" },
];

type Props = {
  productId: string;
  variationValueId?: string;
  onChanged?: () => void;
  embedded?: boolean;
  statusFilter?: "" | InventoryCodeStatus;
  onStatusFilterChange?: (status: "" | InventoryCodeStatus) => void;
  statusCounts?: {
    available: number;
    reserved: number;
    sold: number;
  };
  packageName?: string;
};

const DOWNLOAD_OPTIONS: Array<{
  status: "" | InventoryCodeStatus;
  label: string;
  countKey?: "available" | "reserved" | "sold";
  allCounts?: boolean;
}> = [
  { status: "available", label: "Available", countKey: "available" },
  { status: "reserved", label: "Reserved", countKey: "reserved" },
  { status: "sold", label: "Sold", countKey: "sold" },
  { status: "", label: "All", allCounts: true },
];

function slugifyFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w$.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchAllInventoryCodes(
  productId: string,
  variationValueId: string | undefined,
  status: "" | InventoryCodeStatus,
): Promise<InventoryCodeItem[]> {
  const limit = 100;
  let page = 1;
  let total = 0;
  const items: InventoryCodeItem[] = [];

  while (page === 1 || items.length < total) {
    const data = await listInventoryCodes(productId, {
      status: status || undefined,
      page,
      limit,
      variationValueId,
    });
    total = data.total;
    items.push(...data.items);
    if (data.items.length === 0) break;
    page += 1;
  }

  return items;
}

function triggerCodesDownload(codes: string[], filename: string) {
  const blob = new Blob([codes.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatSoldDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function InventoryCodeList({
  productId,
  variationValueId,
  onChanged,
  embedded = false,
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,
  statusCounts,
  packageName,
}: Props) {
  const searchInputId = useId();
  const [internalStatusFilter, setInternalStatusFilter] = useState<
    "" | InventoryCodeStatus
  >("available");
  const statusFilter = controlledStatusFilter ?? internalStatusFilter;

  function setStatusFilter(next: "" | InventoryCodeStatus) {
    onStatusFilterChange?.(next);
    if (controlledStatusFilter === undefined) {
      setInternalStatusFilter(next);
    }
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<InventoryCodeItem[]>([]);
  const [total, setTotal] = useState(0);
  const limit = 25;
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCost, setEditCost] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const searching = debouncedSearch.trim().length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInventoryCodes(productId, {
        status: statusFilter || undefined,
        page,
        limit,
        variationValueId,
        search: debouncedSearch.trim() || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
      setTotal(0);
      adminToast("Could not load inventory codes.", false);
    } finally {
      setLoading(false);
    }
  }, [
    productId,
    variationValueId,
    statusFilter,
    page,
    limit,
    debouncedSearch,
  ]);

  useEffect(() => {
    setPage(1);
  }, [productId, variationValueId, statusFilter, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const listSummary = (() => {
    if (loading) return "Loading…";
    if (searching) {
      const scope =
        statusFilter === "available" ||
        statusFilter === "reserved" ||
        statusFilter === "sold"
          ? ` in ${STATUS_LABEL[statusFilter]}`
          : "";
      return `${total} match${total === 1 ? "" : "es"} for "${debouncedSearch.trim()}"${scope}`;
    }
    if (statusFilter === "sold") {
      return `${total} sold code${total === 1 ? "" : "s"} in this package`;
    }
    if (statusFilter === "reserved") {
      return `${total} reserved code${total === 1 ? "" : "s"} in this package`;
    }
    if (statusFilter === "available") {
      return `${total} available code${total === 1 ? "" : "s"} in this package`;
    }
    return variationValueId
      ? `${total} code${total === 1 ? "" : "s"} in this package`
      : `${total} code${total === 1 ? "" : "s"}`;
  })();

  function startEdit(item: InventoryCodeItem) {
    setEditingId(item.id);
    setEditValue(item.value);
    setEditCost(item.cost !== undefined ? String(item.cost) : "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
    setEditCost("");
  }

  async function saveEdit(itemId: string) {
    const value = editValue.trim();
    if (!value) {
      adminToast("Code cannot be empty.", false);
      return;
    }
    setBusyId(itemId);
    try {
      await updateInventoryCode(productId, itemId, {
        value,
        cost: editCost ? Number(editCost) : undefined,
      });
      adminToast("Code updated.", true);
      cancelEdit();
      await load();
      onChanged?.();
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Could not update code.",
        false,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: InventoryCodeItem) {
    if (item.status !== "available" && item.status !== "disabled") {
      adminToast("Only available or disabled codes can be deleted.", false);
      return;
    }
    if (!window.confirm(`Delete this code?\n\n${item.value}`)) return;
    setBusyId(item.id);
    try {
      await deleteInventoryCode(productId, item.id);
      adminToast("Code deleted.", true);
      if (editingId === item.id) cancelEdit();
      await load();
      onChanged?.();
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Could not delete code.",
        false,
      );
    } finally {
      setBusyId(null);
    }
  }

  function resolveDownloadCount(option: (typeof DOWNLOAD_OPTIONS)[number]) {
    if (!statusCounts) return null;
    if (option.allCounts) {
      return (
        statusCounts.available + statusCounts.reserved + statusCounts.sold
      );
    }
    if (!option.countKey) return null;
    return statusCounts[option.countKey];
  }

  function clearSearch() {
    setSearchQuery("");
    setDebouncedSearch("");
  }

  async function downloadCodes(option: (typeof DOWNLOAD_OPTIONS)[number]) {
    const count = resolveDownloadCount(option);
    if (count === 0) {
      adminToast(`No ${option.label.toLowerCase()} codes to download.`, false);
      return;
    }

    const downloadKey = option.status || "all";
    setDownloadingKey(downloadKey);
    try {
      const rows = await fetchAllInventoryCodes(
        productId,
        variationValueId,
        option.status,
      );
      if (rows.length === 0) {
        adminToast(`No ${option.label.toLowerCase()} codes to download.`, false);
        return;
      }

      const baseName = slugifyFilename(packageName ?? productId) || "inventory";
      const statusName = option.status || "all";
      triggerCodesDownload(
        rows.map((row) => row.value),
        `${baseName}-${statusName}-codes.txt`,
      );
      adminToast(
        `Downloaded ${rows.length} ${option.label.toLowerCase()} code${rows.length === 1 ? "" : "s"}.`,
        true,
      );
    } catch {
      adminToast("Could not download codes.", false);
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <div
      className={`space-y-3${embedded ? "" : " border-t ui-border-color pt-4"}`}
    >
      <div>
        {!embedded ? (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
            Inventory codes
          </p>
        ) : null}
        <p
          className={`${embedded ? "text-xs font-medium" : "mt-0.5 text-xs"} text-subtle`}
        >
          {listSummary}
        </p>
      </div>

      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Filter codes by status"
      >
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.value;
          const count =
            tab.countKey && statusCounts ? statusCounts[tab.countKey] : null;
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setStatusFilter(tab.value)}
              className={`admin-inventory-code-status-tab${
                isActive ? " admin-inventory-code-status-tab--active" : ""
              }`}
            >
              {tab.label}
              {count !== null ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <div className="admin-inventory-code-downloads">
        <p className="admin-inventory-code-downloads-label">Download codes</p>
        <div className="flex flex-wrap gap-1.5">
          {DOWNLOAD_OPTIONS.map((option) => {
            const count = resolveDownloadCount(option);
            const downloadKey = option.status || "all";
            const isDownloading = downloadingKey === downloadKey;
            const disabled =
              loading ||
              isDownloading ||
              Boolean(downloadingKey) ||
              count === 0;

            return (
              <button
                key={downloadKey}
                type="button"
                disabled={disabled}
                onClick={() => void downloadCodes(option)}
                className="admin-inventory-code-download-btn"
              >
                {isDownloading
                  ? "Downloading…"
                  : `Download ${option.label}${count !== null ? ` (${count})` : ""}`}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor={searchInputId} className="sr-only">
          Search inventory codes
        </label>
        <div className="admin-input-icon-wrap admin-inventory-code-search-wrap">
          <SearchIcon className="admin-input-icon" aria-hidden />
          <input
            id={searchInputId}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code…"
            className="admin-input admin-inventory-code-search w-full text-sm"
          />
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={clearSearch}
              className="admin-inventory-code-search-clear"
              aria-label="Clear search"
            >
              Clear
            </button>
          ) : null}
        </div>
        <p className="admin-inventory-code-search-hint mt-1.5 text-[10px] leading-snug text-subtle">
          {searchQuery.trim() && searchQuery !== debouncedSearch
            ? "Searching…"
            : searching
              ? statusFilter
                ? `Searching ${STATUS_LABEL[statusFilter as InventoryCodeStatus] ?? statusFilter} codes in this package`
                : "Searching all statuses in this package"
              : statusFilter === "sold"
                ? "Sold codes for this package — read only"
                : "Find a code to check if it is already in inventory"}
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-subtle">Loading codes…</p>
      ) : items.length === 0 ? (
        <p className="ui-surface-item ui-surface-item--dashed px-3 py-4 text-xs text-subtle">
          {searching
            ? `No code matching "${debouncedSearch.trim()}" in this package.`
            : statusFilter === "sold"
              ? "No sold codes for this package yet."
              : statusFilter === "reserved"
                ? "No reserved codes for this package."
                : variationValueId
                  ? "No codes for this package yet. Add deliverables above for the selected package only."
                  : "No codes in this filter. Add deliverables above or change the filter."}
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const editing = editingId === item.id;
            const busy = busyId === item.id;
            const canMutate =
              item.status === "available" || item.status === "disabled";
            const soldDate = formatSoldDate(item.soldAt);

            return (
              <li key={item.id} className="ui-surface-item p-3">
                {editing ? (
                  <div className="space-y-2">
                    <div>
                      <label
                        className={labelCls}
                        htmlFor={`inv-code-${item.id}`}
                      >
                        Code
                      </label>
                      <input
                        id={`inv-code-${item.id}`}
                        className={inputCls}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        className={labelCls}
                        htmlFor={`inv-cost-${item.id}`}
                      >
                        Cost (optional)
                      </label>
                      <input
                        id={`inv-cost-${item.id}`}
                        className={inputCls}
                        type="number"
                        min="0"
                        step="0.01"
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveEdit(item.id)}
                        className="btn-primary-sm disabled:opacity-50"
                      >
                        {busy ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={cancelEdit}
                        className="dashboard-pro-btn-ghost text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-xs text-foreground">
                        {item.value}
                      </p>
                      <p className="mt-1 text-[10px] text-subtle">
                        {STATUS_LABEL[item.status]}
                        {item.cost !== undefined ? ` · cost ${item.cost}` : ""}
                        {soldDate ? ` · sold ${soldDate}` : ""}
                      </p>
                    </div>
                    {canMutate ? (
                      <div className="flex flex-wrap gap-1 self-end sm:shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(item)}
                          className="dashboard-pro-btn-ghost px-2 py-1 text-[10px]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void remove(item)}
                          className="dashboard-pro-btn-ghost px-2 py-1 text-[10px] text-rose-300"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-subtle">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="dashboard-pro-btn-ghost px-2 py-1"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="dashboard-pro-btn-ghost px-2 py-1"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
