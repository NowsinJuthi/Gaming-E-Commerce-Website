"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { PriceText } from "@/components/ui/PriceText";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CheckIcon,
  PulseIcon,
  TagIcon,
  TruckIcon,
} from "@/components/admin/icons";
import {
  adminListProducts,
  createOffering,
  deleteOffering,
  getAdminSuppliersStats,
  listOfferings,
  listSuppliers,
  refreshSupplierBalance,
  updateOffering,
  updateSupplier,
  upsertSupplier,
  type AdminProduct,
  type AdminSuppliersStats,
  type OfferingInput,
  type Supplier,
  type SupplierCode,
  type SupplierOffering,
  type SupplierStatus,
  formatPrice,
} from "@/lib/api";

const CODES: SupplierCode[] = [
  "reloadly",
  "xsolla",
  "turgame",
  "foxreload",
];

const CODE_OPTIONS = CODES.map((code) => ({ value: code, label: code }));

const STATUS_STYLE: Record<SupplierStatus, string> = {
  active: "dashboard-pro-status dashboard-pro-status--green",
  disabled: "dashboard-pro-status",
};

function offeringStatusClass(enabled: boolean) {
  return enabled ? STATUS_STYLE.active : STATUS_STYLE.disabled;
}

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

type SupplierForm = {
  code: SupplierCode;
  name: string;
  status: SupplierStatus;
  priority: string;
  regions: string;
  currencies: string;
};

const EMPTY_SUP: SupplierForm = {
  code: "reloadly",
  name: "",
  status: "active",
  priority: "100",
  regions: "GLOBAL",
  currencies: "BDT",
};

type OfferingForm = {
  supplierCode: SupplierCode;
  productId: string;
  externalProductId: string;
  cost: string;
  currency: string;
  region: string;
  priority: string;
  enabled: boolean;
};

const EMPTY_OFF: OfferingForm = {
  supplierCode: "reloadly",
  productId: "",
  externalProductId: "",
  cost: "",
  currency: "BDT",
  region: "GLOBAL",
  priority: "100",
  enabled: true,
};

function mergeSupplierRow(current: Supplier[], saved: Supplier): Supplier[] {
  const exists = current.some((row) => row.code === saved.code);
  if (exists) {
    return current.map((row) => (row.code === saved.code ? saved : row));
  }
  return [...current, saved].sort((a, b) => a.priority - b.priority);
}

function patchSupplierBalance(
  current: Supplier[],
  code: SupplierCode,
  balance: number,
  currency: string,
): Supplier[] {
  return current.map((row) =>
    row.code === code
      ? { ...row, lastBalance: balance, lastBalanceCurrency: currency }
      : row,
  );
}

function productTitle(id: string | undefined, titles: Map<string, string>) {
  if (!id) return "—";
  return titles.get(id) ?? id;
}

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type SupplierStatTone = "brand" | "success" | "amber" | "muted";

type SupplierRegistryStat = {
  key: string;
  tone: SupplierStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function SupplierRegistryOverview({ items }: { items: SupplierRegistryStat[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-suppliers-overview"
      aria-label="Supplier registry overview"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-suppliers-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-suppliers-overview-stat-icon admin-suppliers-overview-stat-icon--${item.tone}`}
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

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [offerings, setOfferings] = useState<SupplierOffering[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [stats, setStats] = useState<AdminSuppliersStats | null>(null);
  const [supForm, setSupForm] = useState<SupplierForm>(EMPTY_SUP);
  const [offForm, setOffForm] = useState<OfferingForm>(EMPTY_OFF);
  const [coreLoading, setCoreLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingOffering, setSavingOffering] = useState(false);
  const [busyCode, setBusyCode] = useState<SupplierCode | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const reloadCore = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setCoreLoading(true);
    }
    try {
      const [supplierList, offeringList] = await Promise.all([
        listSuppliers(),
        listOfferings(),
      ]);
      setSuppliers(supplierList);
      setOfferings(offeringList);
    } catch {
      if (!silent) {
        setSuppliers([]);
        setOfferings([]);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setCoreLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCoreLoading(true);
    setProductsLoading(true);
    setStatsLoading(true);

    Promise.all([
      listSuppliers(),
      listOfferings(),
      adminListProducts(),
      getAdminSuppliersStats(),
    ])
      .then(([supplierList, offeringList, productList, supplierStats]) => {
        if (cancelled) return;
        setSuppliers(supplierList);
        setOfferings(offeringList);
        setProducts(productList);
        setStats(supplierStats);
      })
      .catch(() => {
        if (!cancelled) {
          setSuppliers([]);
          setOfferings([]);
          setProducts([]);
          setStats(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCoreLoading(false);
          setProductsLoading(false);
          setStatsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const productTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      map.set(product._id, product.title);
    }
    return map;
  }, [products]);

  const productOptions = useMemo(
    () => [
      { value: "", label: "Select product…" },
      ...products.map((product) => ({
        value: product._id,
        label: product.title,
      })),
    ],
    [products],
  );

  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.status === "active",
  ).length;
  const enabledOfferings = offerings.filter((offering) => offering.enabled)
    .length;
  const successRate = stats?.procurement.successRate;

  function editSupplier(supplier: Supplier) {
    setSupForm({
      code: supplier.code,
      name: supplier.name,
      status: supplier.status,
      priority: String(supplier.priority),
      regions: (supplier.supportedRegions ?? []).join(", "),
      currencies: (supplier.supportedCurrencies ?? []).join(", "),
    });
  }

  function resetSupplierForm() {
    setSupForm(EMPTY_SUP);
  }

  async function saveSupplier(e: React.FormEvent) {
    e.preventDefault();
    setSavingSupplier(true);
    hideAdminToast();
    try {
      const saved = await upsertSupplier({
        code: supForm.code,
        name: supForm.name,
        status: supForm.status,
        priority: Number(supForm.priority || 100),
        supportedRegions: supForm.regions
          .split(",")
          .map((region) => region.trim())
          .filter(Boolean),
        supportedCurrencies: supForm.currencies
          .split(",")
          .map((currency) => currency.trim())
          .filter(Boolean),
      });
      setSuppliers((current) => mergeSupplierRow(current, saved));
      adminToast("Supplier saved.", true);
      resetSupplierForm();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed.", false);
      void reloadCore(true);
    } finally {
      setSavingSupplier(false);
    }
  }

  async function toggleSupplier(supplier: Supplier) {
    const next: SupplierStatus =
      supplier.status === "active" ? "disabled" : "active";
    setBusyCode(supplier.code);
    hideAdminToast();
    try {
      const updated = await updateSupplier(supplier.code, { status: next });
      setSuppliers((current) =>
        current.map((row) => (row.code === updated.code ? updated : row)),
      );
      adminToast(`${supplier.name} is now ${next}.`, true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Update failed.", false);
      void reloadCore(true);
    } finally {
      setBusyCode(null);
    }
  }

  async function checkBalance(code: SupplierCode) {
    setBusyCode(code);
    hideAdminToast();
    try {
      const balance = await refreshSupplierBalance(code);
      setSuppliers((current) =>
        patchSupplierBalance(
          current,
          code,
          balance.balance,
          balance.currency,
        ),
      );
      adminToast(`Balance: ${formatPrice(balance.balance, balance.currency)}`, true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Balance check failed.", false);
      void reloadCore(true);
    } finally {
      setBusyCode(null);
    }
  }

  async function saveOffering(e: React.FormEvent) {
    e.preventDefault();
    setSavingOffering(true);
    hideAdminToast();
    try {
      const payload: OfferingInput = {
        supplierCode: offForm.supplierCode,
        externalProductId: offForm.externalProductId,
        cost: Number(offForm.cost || 0),
        currency: offForm.currency || "BDT",
        region: offForm.region || undefined,
        priority: Number(offForm.priority || 100),
        enabled: offForm.enabled,
      };
      if (offForm.productId.trim()) {
        payload.productId = offForm.productId.trim();
      }
      const created = await createOffering(payload);
      setOfferings((current) => [...current, created]);
      adminToast("Offering created.", true);
      setOffForm(EMPTY_OFF);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Offering failed.", false);
      void reloadCore(true);
    } finally {
      setSavingOffering(false);
    }
  }

  async function toggleOffering(offering: SupplierOffering) {
    hideAdminToast();
    try {
      const updated = await updateOffering(offering._id, {
        enabled: !offering.enabled,
      });
      setOfferings((current) =>
        current.map((row) => (row._id === updated._id ? updated : row)),
      );
      adminToast(`Offering ${updated.enabled ? "enabled" : "disabled"}.`, true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Update failed.", false);
      void reloadCore(true);
    }
  }

  async function removeOffering(id: string) {
    if (!confirm("Delete this offering?")) return;
    hideAdminToast();
    try {
      await deleteOffering(id);
      setOfferings((current) => current.filter((row) => row._id !== id));
      adminToast("Offering deleted.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Delete failed.", false);
      void reloadCore(true);
    }
  }

  const statsPending = coreLoading && suppliers.length === 0;
  const procurementPending = statsLoading && !stats;
  const editingSupplier = suppliers.some(
    (supplier) => supplier.code === supForm.code,
  );

  const registryStats = useMemo<SupplierRegistryStat[]>(
    () => [
      {
        key: "suppliers",
        tone: "brand",
        icon: <TruckIcon className="h-4 w-4" />,
        label: "Suppliers",
        value: loadingStat(statsPending, suppliers.length.toLocaleString()),
        meta: "Configured upstream",
      },
      {
        key: "active",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Active",
        value: loadingStat(statsPending, activeSuppliers.toLocaleString()),
        meta: "Available for failover",
      },
      {
        key: "offerings",
        tone: "amber",
        icon: <TagIcon className="h-4 w-4" />,
        label: "Offerings",
        value: loadingStat(statsPending, offerings.length.toLocaleString()),
        meta: statsPending
          ? "…"
          : `${enabledOfferings.toLocaleString()} enabled mappings`,
      },
      {
        key: "procurement",
        tone: "brand",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Procurement",
        value: procurementPending
          ? "…"
          : successRate != null
            ? `${successRate.toFixed(1)}%`
            : "—",
        meta: procurementPending
          ? "Loading procurement stats…"
          : stats
            ? `${stats.procurement.success.toLocaleString()} success · ${stats.procurement.failed.toLocaleString()} failed`
            : "Success rate unavailable",
      },
    ],
    [
      activeSuppliers,
      enabledOfferings,
      offerings.length,
      procurementPending,
      stats,
      statsPending,
      successRate,
      suppliers.length,
    ],
  );

  return (
    <AdminPageLayout
      section="Settings"
      title="Suppliers"
      description="Configure upstream suppliers, failover priority, balances, and product mappings."
      icon={TruckIcon}
      backHref="/admin/settings"
      backLabel="General"
      action={
        activeSuppliers > 0 ? (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            {activeSuppliers.toLocaleString()} active
          </span>
        ) : null
      }
    >

      <div className="admin-suppliers-page space-y-5">
            <AdminOrderListCard
              icon={<TruckIcon className="h-4 w-4" />}
              title="Supplier registry"
              subtitle={
                coreLoading
                  ? "Loading suppliers…"
                  : refreshing
                    ? "Refreshing…"
                    : `${suppliers.length.toLocaleString()} supplier${suppliers.length === 1 ? "" : "s"} · ${activeSuppliers.toLocaleString()} active`
              }
              className="admin-suppliers-catalog"
            >
              <SupplierRegistryOverview items={registryStats} />

              <div className="admin-suppliers-summary flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
                <span>
                  <span className="font-semibold text-foreground">Priority</span>{" "}
                  Lower number = tried first
                </span>
                <span>
                  <span className="font-semibold text-foreground">Codes</span>{" "}
                  {CODES.join(", ")}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Catalog</span>{" "}
                  {productsLoading
                    ? "Loading products…"
                    : `${products.length.toLocaleString()} items for mappings`}
                </span>
              </div>

              <div className="flex flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => void reloadCore(true)}
                  disabled={coreLoading || refreshing}
                  className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                >
                  {coreLoading || refreshing ? "Refreshing…" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={resetSupplierForm}
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  New supplier
                </button>
              </div>

              {coreLoading ? (
                <div className="admin-products-table-empty">Loading suppliers…</div>
              ) : suppliers.length === 0 ? (
                <div className="dashboard-pro-empty px-4 py-8">
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <TruckIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    No suppliers yet
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                    Add your first upstream supplier using the form below.
                  </p>
                </div>
              ) : (
                <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                  <table className="panel-3d-table admin-suppliers-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Balance</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((supplier) => (
                        <tr
                          key={supplier._id}
                          className={`text-foreground-muted ${
                            editingSupplier && supForm.code === supplier.code
                              ? "bg-brand/5"
                              : ""
                          }`}
                        >
                          <td>
                            <p className="font-medium text-foreground">
                              {supplier.name}
                            </p>
                            <p className="font-mono text-xs text-subtle">
                              {supplier.code}
                            </p>
                          </td>
                          <td>{supplier.priority}</td>
                          <td>
                            <span
                              className={`capitalize ${STATUS_STYLE[supplier.status]}`}
                            >
                              {supplier.status}
                            </span>
                          </td>
                          <td className="text-xs">
                            {supplier.lastBalance != null
                              ? `${supplier.lastBalance} ${supplier.lastBalanceCurrency ?? ""}`
                              : "—"}
                          </td>
                          <td className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => editSupplier(supplier)}
                                className="dashboard-pro-btn-ghost text-xs"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={busyCode === supplier.code}
                                onClick={() => void toggleSupplier(supplier)}
                                className="dashboard-pro-btn-ghost text-xs"
                              >
                                {supplier.status === "active" ? "Disable" : "Enable"}
                              </button>
                              <button
                                type="button"
                                disabled={busyCode === supplier.code}
                                onClick={() => void checkBalance(supplier.code)}
                                className="dashboard-pro-btn-ghost text-xs"
                              >
                                Balance
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminOrderListCard>

            <AdminOrderListCard
              icon={<TagIcon className="h-4 w-4" />}
              title="Product offerings"
              subtitle={
                coreLoading
                  ? "Loading offerings…"
                  : `${offerings.length.toLocaleString()} mapping${offerings.length === 1 ? "" : "s"} · ${enabledOfferings.toLocaleString()} enabled`
              }
              className="admin-suppliers-offerings-catalog"
            >
              {coreLoading ? (
                <div className="admin-products-table-empty">Loading offerings…</div>
              ) : offerings.length === 0 ? (
                <div className="dashboard-pro-empty px-4 py-8">
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <TagIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    No offerings yet
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                    Create a mapping to route product delivery through a supplier.
                  </p>
                </div>
              ) : (
                <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                  <table className="panel-3d-table admin-suppliers-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Supplier</th>
                        <th>External ID</th>
                        <th>Cost</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offerings.map((offering) => (
                        <tr key={offering._id} className="text-foreground-muted">
                          <td className="font-medium text-foreground">
                            {productTitle(offering.productId, productTitleById)}
                          </td>
                          <td className="font-mono text-xs">{offering.supplierCode}</td>
                          <td className="font-mono text-xs">
                            {offering.externalProductId}
                          </td>
                          <td>
                            <PriceText
                              amount={offering.cost}
                              currency={offering.currency}
                            />
                          </td>
                          <td>{offering.priority ?? "—"}</td>
                          <td>
                            <span
                              className={`capitalize ${offeringStatusClass(offering.enabled)}`}
                            >
                              {offering.enabled ? "enabled" : "disabled"}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => void toggleOffering(offering)}
                                className="dashboard-pro-btn-ghost text-xs"
                              >
                                {offering.enabled ? "Disable" : "Enable"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeOffering(offering._id)}
                                className="dashboard-pro-btn-ghost text-xs text-rose-400"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminOrderListCard>

            <div className="admin-suppliers-forms-grid">
            <form onSubmit={saveSupplier}>
              <ProductFormOrderCard
                className="admin-product-form-section h-full"
                icon={<TruckIcon className="h-4 w-4" />}
                title={editingSupplier ? "Edit supplier" : "New supplier"}
                subtitle={
                  editingSupplier
                    ? "Update details and save changes."
                    : "Add an upstream integration for auto-delivery failover."
                }
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Supplier details</dt>
                  <dd className="admin-product-form-sidebar-fields space-y-4">
                    <div>
                      <label htmlFor="supplier-code" className={labelCls}>
                        Code
                      </label>
                      <AdminSelect
                        id="supplier-code"
                        value={supForm.code}
                        onChange={(value) =>
                          setSupForm((current) => ({
                            ...current,
                            code: value as SupplierCode,
                          }))
                        }
                        options={CODE_OPTIONS}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label htmlFor="supplier-name" className={labelCls}>
                        Name
                      </label>
                      <input
                        id="supplier-name"
                        required
                        value={supForm.name}
                        onChange={(e) =>
                          setSupForm((current) => ({
                            ...current,
                            name: e.target.value,
                          }))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="supplier-priority" className={labelCls}>
                          Priority
                        </label>
                        <input
                          id="supplier-priority"
                          type="number"
                          value={supForm.priority}
                          onChange={(e) =>
                            setSupForm((current) => ({
                              ...current,
                              priority: e.target.value,
                            }))
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor="supplier-status" className={labelCls}>
                          Status
                        </label>
                        <AdminSelect
                          id="supplier-status"
                          value={supForm.status}
                          onChange={(value) =>
                            setSupForm((current) => ({
                              ...current,
                              status: value as SupplierStatus,
                            }))
                          }
                          options={[
                            { value: "active", label: "Active" },
                            { value: "disabled", label: "Disabled" },
                          ]}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="supplier-regions" className={labelCls}>
                        Regions
                      </label>
                      <input
                        id="supplier-regions"
                        value={supForm.regions}
                        onChange={(e) =>
                          setSupForm((current) => ({
                            ...current,
                            regions: e.target.value,
                          }))
                        }
                        placeholder="GLOBAL, US, EU"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="supplier-currencies" className={labelCls}>
                        Currencies
                      </label>
                      <input
                        id="supplier-currencies"
                        value={supForm.currencies}
                        onChange={(e) =>
                          setSupForm((current) => ({
                            ...current,
                            currencies: e.target.value,
                          }))
                        }
                        placeholder="BDT, USD"
                        className={inputCls}
                      />
                    </div>
                  </dd>
                </div>

                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Save</dt>
                  <dd className="admin-product-form-sidebar-fields">
                    <div className="flex flex-wrap justify-end gap-2.5">
                      {editingSupplier ? (
                        <button
                          type="button"
                          onClick={resetSupplierForm}
                          className="dashboard-pro-btn-ghost"
                        >
                          Cancel
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        disabled={savingSupplier}
                        className="btn-primary disabled:opacity-50"
                      >
                        {savingSupplier ? "Saving…" : "Save supplier"}
                      </button>
                    </div>
                  </dd>
                </div>
              </ProductFormOrderCard>
            </form>

            <form onSubmit={saveOffering}>
              <ProductFormOrderCard
                className="admin-product-form-section h-full"
                icon={<TagIcon className="h-4 w-4" />}
                title="New offering"
                subtitle="Link a catalog product to a supplier external SKU."
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Mapping</dt>
                  <dd className="admin-product-form-sidebar-fields space-y-4">
                    <div>
                      <label htmlFor="offering-supplier" className={labelCls}>
                        Supplier
                      </label>
                      <AdminSelect
                        id="offering-supplier"
                        value={offForm.supplierCode}
                        onChange={(value) =>
                          setOffForm((current) => ({
                            ...current,
                            supplierCode: value as SupplierCode,
                          }))
                        }
                        options={CODE_OPTIONS}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label htmlFor="offering-product" className={labelCls}>
                        Product
                      </label>
                      <AdminSelect
                        id="offering-product"
                        value={offForm.productId}
                        onChange={(value) =>
                          setOffForm((current) => ({
                            ...current,
                            productId: value,
                          }))
                        }
                        options={productOptions}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label htmlFor="offering-external-id" className={labelCls}>
                        External product ID
                      </label>
                      <input
                        id="offering-external-id"
                        required
                        value={offForm.externalProductId}
                        onChange={(e) =>
                          setOffForm((current) => ({
                            ...current,
                            externalProductId: e.target.value,
                          }))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="offering-cost" className={labelCls}>
                          Cost
                        </label>
                        <input
                          id="offering-cost"
                          type="number"
                          step="0.01"
                          required
                          value={offForm.cost}
                          onChange={(e) =>
                            setOffForm((current) => ({
                              ...current,
                              cost: e.target.value,
                            }))
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor="offering-priority" className={labelCls}>
                          Priority
                        </label>
                        <input
                          id="offering-priority"
                          type="number"
                          value={offForm.priority}
                          onChange={(e) =>
                            setOffForm((current) => ({
                              ...current,
                              priority: e.target.value,
                            }))
                          }
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="offering-currency" className={labelCls}>
                        Currency
                      </label>
                      <input
                        id="offering-currency"
                        value={offForm.currency}
                        onChange={(e) =>
                          setOffForm((current) => ({
                            ...current,
                            currency: e.target.value,
                          }))
                        }
                        className={inputCls}
                      />
                    </div>
                  </dd>
                </div>

                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Save</dt>
                  <dd className="admin-product-form-sidebar-fields">
                    <button
                      type="submit"
                      disabled={
                        savingOffering || !offForm.productId || productsLoading
                      }
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {savingOffering ? "Creating…" : "Create offering"}
                    </button>
                  </dd>
                </div>
              </ProductFormOrderCard>
            </form>
            </div>

            <ProductFormOrderCard
              className="admin-product-form-section"
              icon={<PulseIcon className="h-4 w-4" />}
              title="Setup guide"
              subtitle="Failover, codes, and balance checks"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Failover</dt>
                <dd className="text-sm text-foreground-muted">
                  Lower priority numbers are attempted first when auto-delivery
                  routes an order through upstream suppliers.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Supported codes</dt>
                <dd className="font-mono text-xs text-foreground-muted">
                  {CODES.join(" · ")}
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Balance checks</dt>
                <dd className="text-sm text-foreground-muted">
                  Use Balance on a supplier row to refresh wallet funds before
                  high-volume delivery windows.
                </dd>
              </div>
            </ProductFormOrderCard>
      </div>
    </AdminPageLayout>
  );
}
