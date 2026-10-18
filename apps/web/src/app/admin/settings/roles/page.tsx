"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  CheckIcon,
  LockIcon,
  PulseIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/admin/icons";
import {
  getRolePermissionsOverview,
  resetAllRolePermissions,
  resetRolePermissions,
  updateRolePermissions,
  type RolePermissionProfile,
} from "@/lib/api";
import { mergeRolePermissionsOverview } from "@/lib/admin-role-catalog";
import { notifyPanelConfigChanged } from "@/lib/customer-panel";
import {
  PERMISSION_GROUPS,
  permissionGroupSubtitle,
  permissionGroupsForRole,
  GUEST_STOREFRONT_ONLY_PERMISSION_KEYS,
} from "@/lib/role-permissions";

type RolesOverview = Awaited<ReturnType<typeof getRolePermissionsOverview>>;

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type RoleStatTone = "brand" | "success" | "amber" | "muted";

type RolesOverviewStat = {
  key: string;
  tone: RoleStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function RolesOverviewStats({ items }: { items: RolesOverviewStat[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-roles-overview"
      aria-label="Roles overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-roles-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-roles-overview-stat-icon admin-roles-overview-stat-icon--${item.tone}`}
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

function countEnabledPermissions(permissions: Record<string, boolean>) {
  return Object.values(permissions).filter(Boolean).length;
}

function patchOverviewRole(
  overview: RolesOverview,
  updatedRole: RolePermissionProfile,
): RolesOverview {
  const roles = overview.roles.map((role) =>
    role.id === updatedRole.id ? updatedRole : role,
  );
  return {
    ...overview,
    roles,
    customizedCount: roles.filter((role) => role.customized).length,
    adminAccessCount: roles.filter(
      (role) => role.permissions.admin_panel_access,
    ).length,
  };
}

function isRoleDirty(
  role: RolePermissionProfile,
  draft: Record<string, boolean>,
) {
  return permissionGroupsForRole(role.id).some((group) =>
    group.permissions.some(
      (permission) => draft[permission.key] !== role.permissions[permission.key],
    ),
  );
}

const RoleNavButton = memo(function RoleNavButton({
  role,
  active,
  onSelect,
}: {
  role: RolePermissionProfile;
  active: boolean;
  onSelect: (role: RolePermissionProfile) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(role)}
      aria-pressed={active}
      className={`admin-roles-nav-btn${
        active ? " admin-roles-nav-btn--active" : ""
      }`}
    >
      <span>{role.label}</span>
      {role.locked ? (
        <LockIcon className="h-3.5 w-3.5 shrink-0 text-violet-400" />
      ) : role.customized ? (
        <span className="dashboard-pro-status text-[10px]">edited</span>
      ) : null}
    </button>
  );
});

const PermissionToggle = memo(function PermissionToggle({
  permKey,
  label,
  enabled,
  locked,
  onToggle,
}: {
  permKey: string;
  label: string;
  enabled: boolean;
  locked: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(permKey)}
      disabled={locked}
      aria-pressed={enabled}
      className={`admin-roles-perm-btn${
        enabled ? " admin-roles-perm-btn--on" : ""
      }`}
    >
      <span
        className={`admin-roles-perm-check${
          enabled ? " admin-roles-perm-check--on" : ""
        }`}
      >
        {enabled ? <CheckIcon className="h-3.5 w-3.5" /> : null}
      </span>
      {label}
    </button>
  );
});

export default function AdminRolesPage() {
  const [overview, setOverview] = useState<RolesOverview | null>(null);
  const [selectedId, setSelectedId] = useState("shop_manager");
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [coreLoading, setCoreLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missingServerRoles, setMissingServerRoles] = useState<string[]>([]);
  const serverRoleIdsRef = useRef<Set<string>>(new Set());

  const refreshBusyRef = useRef(false);
  const selectedIdRef = useRef(selectedId);
  const draftRef = useRef(draft);
  selectedIdRef.current = selectedId;
  draftRef.current = draft;

  const selected = useMemo(
    () => overview?.roles.find((role) => role.id === selectedId) ?? null,
    [overview, selectedId],
  );

  const guestRoleProfile = useMemo(
    () => overview?.roles.find((role) => role.id === "guest") ?? null,
    [overview],
  );

  const dirty = selected ? isRoleDirty(selected, draft) : false;
  const enabledCount = useMemo(() => countEnabledPermissions(draft), [draft]);

  const loadCore = useCallback(async (silent = false, keepRoleId?: string) => {
    if (silent) {
      if (refreshBusyRef.current) return;
      refreshBusyRef.current = true;
      setRefreshing(true);
    } else {
      setCoreLoading(true);
      setLoadError(null);
    }
    try {
      const raw = await getRolePermissionsOverview();
      const merged = mergeRolePermissionsOverview(raw);
      serverRoleIdsRef.current = merged.serverRoleIds;
      setMissingServerRoles(merged.missingOnServer);
      setOverview(merged.overview);
      if (silent) return;
      const role =
        merged.overview.roles.find(
          (row) => row.id === (keepRoleId ?? selectedIdRef.current),
        ) ?? merged.overview.roles[0];
      if (role) {
        setSelectedId(role.id);
        setDraft({ ...role.permissions });
      }
    } catch (err) {
      if (!silent) {
        setOverview(null);
        setLoadError(
          err instanceof Error
            ? err.message
            : "Could not load roles. Ensure the API is running and you are logged in as admin.",
        );
      }
    } finally {
      if (silent) {
        refreshBusyRef.current = false;
        setRefreshing(false);
      } else {
        setCoreLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  const selectRole = useCallback((role: RolePermissionProfile) => {
    setSelectedId(role.id);
    setDraft({ ...role.permissions });
  }, []);

  const togglePermission = useCallback((key: string) => {
    setDraft((current) => {
      const role = overview?.roles.find(
        (row) => row.id === selectedIdRef.current,
      );
      if (role?.locked) return current;
      if (
        role?.id !== "guest" &&
        GUEST_STOREFRONT_ONLY_PERMISSION_KEYS.has(key)
      ) {
        return current;
      }
      const next = { ...current, [key]: !current[key] };
      if (key === "guest_checkout") {
        next.guest_use_cart = next.guest_checkout === true;
      }
      if (key === "live_chat_without_login") {
        next.guest_live_chat = next.live_chat_without_login === true;
      }
      return next;
    });
  }, [overview]);

  const saveRole = useCallback(async () => {
    const roleId = selectedIdRef.current;
    const role = overview?.roles.find((row) => row.id === roleId);
    const permissions = draftRef.current;
    if (!role || role.locked || !isRoleDirty(role, permissions)) return;
    if (!serverRoleIdsRef.current.has(roleId)) {
      adminToast(
        "This role is not on the running API yet. Rebuild and restart the API service (rebuild-api.sh), then refresh.",
        false,
      );
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await updateRolePermissions(roleId, permissions);
      setOverview((current) =>
        current ? patchOverviewRole(current, updated) : current,
      );
      setDraft({ ...updated.permissions });
      if (roleId === "guest") {
        notifyPanelConfigChanged();
      }
      adminToast("Role saved.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed.", false);
    } finally {
      setBusy(false);
    }
  }, [overview]);

  const resetRole = useCallback(async () => {
    const roleId = selectedIdRef.current;
    const role = overview?.roles.find((row) => row.id === roleId);
    if (!role || role.locked) return;
    if (!serverRoleIdsRef.current.has(roleId)) {
      adminToast(
        "This role is not on the running API yet. Rebuild and restart the API service first.",
        false,
      );
      return;
    }
    if (!window.confirm(`Reset "${role.label}" to default permissions? Unsaved changes will be lost.`)) return;
    setBusy(true);
    hideAdminToast();
    try {
      const updated = await resetRolePermissions(roleId);
      setOverview((current) =>
        current ? patchOverviewRole(current, updated) : current,
      );
      setDraft({ ...updated.permissions });
      adminToast("Role reset to defaults.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Reset failed.", false);
    } finally {
      setBusy(false);
    }
  }, [overview]);

  const resetAll = useCallback(async () => {
    if (!window.confirm("Reset ALL roles to default permissions? This will discard all customizations.")) return;
    setBusy(true);
    hideAdminToast();
    try {
      const data = await resetAllRolePermissions();
      const merged = mergeRolePermissionsOverview(data);
      serverRoleIdsRef.current = merged.serverRoleIds;
      setMissingServerRoles(merged.missingOnServer);
      setOverview(merged.overview);
      const role =
        merged.overview.roles.find((row) => row.id === selectedIdRef.current) ??
        merged.overview.roles[0];
      if (role) {
        setSelectedId(role.id);
        setDraft({ ...role.permissions });
      }
      adminToast("All roles reset.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Reset failed.", false);
    } finally {
      setBusy(false);
    }
  }, []);

  const statsPending = coreLoading && !overview;

  const rolesOverviewStats = useMemo<RolesOverviewStat[]>(
    () => [
      {
        key: "roles",
        tone: "brand",
        icon: <UsersIcon className="h-4 w-4" />,
        label: "Roles",
        value: loadingStat(
          statsPending,
          (overview?.roleCount ?? 0).toLocaleString(),
        ),
        meta: "Role profiles",
      },
      {
        key: "customized",
        tone: "amber",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Customized",
        value: loadingStat(
          statsPending,
          (overview?.customizedCount ?? 0).toLocaleString(),
        ),
        meta: "Changed from defaults",
      },
      {
        key: "admin-access",
        tone: "success",
        icon: <LockIcon className="h-4 w-4" />,
        label: "Admin access",
        value: loadingStat(
          statsPending,
          (overview?.adminAccessCount ?? 0).toLocaleString(),
        ),
        meta: "Roles with panel access",
      },
      {
        key: "enabled",
        tone: selected ? "brand" : "muted",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Enabled",
        value: loadingStat(
          statsPending,
          selected ? enabledCount.toLocaleString() : "0",
        ),
        meta: selected
          ? `Permissions for ${selected.label}`
          : "Select a role",
      },
    ],
    [enabledCount, overview, selected, statsPending],
  );

  return (
    <AdminPageLayout
      section="Settings"
      title="Role & permission management"
      description="Configure what each role can access in the admin panel. Changes apply immediately."
      icon={ShieldIcon}
      backHref="/admin/settings"
      backLabel="General"
      action={
        statsPending ? null : (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            {(overview?.adminAccessCount ?? 0).toLocaleString()} admin access
          </span>
        )
      }
    >

      {missingServerRoles.length > 0 ? (
        <ProductFormOrderCard
          title="API update required to save Guest limits"
          subtitle={`The roles list includes ${missingServerRoles.join(", ")} from the latest app code, but your API still returns an older profile set. Rebuild and restart the NestJS API (deploy/rebuild-api.sh), then click Refresh.`}
          className="space-y-3 border-amber-500/30 bg-amber-500/10"
        >
          <button
            type="button"
            onClick={() => void loadCore(true, selectedId)}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Refresh after API deploy
          </button>
        </ProductFormOrderCard>
      ) : null}

      {loadError && !overview ? (
        <ProductFormOrderCard
          title="Could not load roles"
          subtitle={loadError}
          className="space-y-3"
        >
          <button
            type="button"
            onClick={() => void loadCore()}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Retry
          </button>
        </ProductFormOrderCard>
      ) : (
        <>
          <div className="admin-roles-page space-y-5">
                <AdminOrderListCard
                  icon={<ShieldIcon className="h-4 w-4" />}
                  title="Roles overview"
                  subtitle={
                    statsPending
                      ? "Loading role profiles…"
                      : `${overview?.roleCount ?? 0} profiles · ${overview?.adminAccessCount ?? 0} with admin access`
                  }
                  className="admin-roles-catalog"
                >
                  <RolesOverviewStats items={rolesOverviewStats} />

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
                    <span>
                      <span className="font-semibold text-foreground">Selected</span>{" "}
                      {statsPending ? "…" : (selected?.label ?? "—")}
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">Status</span>{" "}
                      {statsPending
                        ? "…"
                        : selected?.locked
                          ? "Locked"
                          : selected?.customized
                            ? "Customized"
                            : "Default"}
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">Unsaved</span>{" "}
                      {statsPending ? "…" : dirty ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => void loadCore(true, selectedId)}
                      disabled={coreLoading || refreshing}
                      className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                    >
                      {refreshing || coreLoading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>
                </AdminOrderListCard>

                <div className="admin-roles-workspace grid min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <ProductFormOrderCard
                    icon={<UsersIcon className="h-4 w-4" />}
                    title="Roles"
                    subtitle={
                      statsPending
                        ? "…"
                        : `${overview?.roleCount ?? 0} role profiles`
                    }
                    className="admin-product-form-section admin-roles-sidebar-card"
                  >
                    <dl>
                      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                        <dt>Profiles</dt>
                        <dd>
                          <nav className="admin-roles-nav" aria-label="Roles">
                            {(overview?.roles ?? []).map((role) => (
                              <RoleNavButton
                                key={role.id}
                                role={role}
                                active={role.id === selectedId}
                                onSelect={selectRole}
                              />
                            ))}
                          </nav>
                        </dd>
                      </div>
                    </dl>
                  </ProductFormOrderCard>

                  <div className="admin-roles-main min-w-0 space-y-5">
                    {selected ? (
                      <>
                        <ProductFormOrderCard
                          icon={<ShieldIcon className="h-4 w-4" />}
                          title={selected.label}
                          subtitle={selected.description}
                          className="admin-product-form-section admin-roles-header"
                          action={
                            <div className="flex flex-wrap gap-2">
                              {selected.locked ? (
                                <span className="dashboard-pro-status">Locked</span>
                              ) : null}
                              {selected.customized ? (
                                <span className="dashboard-pro-status dashboard-pro-status--amber">
                                  Customized
                                </span>
                              ) : null}
                            </div>
                          }
                        >
                          <dl>
                            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                              <dt>Actions</dt>
                              <dd className="admin-product-form-sidebar-fields">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void saveRole()}
                                    disabled={busy || selected.locked || !dirty}
                                    className="btn-primary disabled:opacity-50"
                                  >
                                    {busy ? "Saving…" : "Save role"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void resetRole()}
                                    disabled={busy || selected.locked}
                                    className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                                  >
                                    Reset role
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void resetAll()}
                                    disabled={busy}
                                    className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                                  >
                                    Reset all
                                  </button>
                                </div>
                              </dd>
                            </div>
                          </dl>
                        </ProductFormOrderCard>

                        <ProductFormOrderCard
                          icon={<CheckIcon className="h-4 w-4" />}
                          title="Role summary"
                          subtitle="Capabilities included in this profile"
                          className="admin-product-form-section admin-roles-summary-panel"
                        >
                          <dl>
                            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                              <dt>Includes</dt>
                              <dd>
                                <ul className="space-y-2">
                                  {selected.summary.map((line) => (
                                    <li
                                      key={line}
                                      className="flex items-start gap-2 text-sm text-foreground-muted"
                                    >
                                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                                      {line}
                                    </li>
                                  ))}
                                </ul>
                              </dd>
                            </div>
                          </dl>
                        </ProductFormOrderCard>

                        {permissionGroupsForRole(selected.id).map((group) => (
                          <ProductFormOrderCard
                            key={group.key}
                            icon={<LockIcon className="h-4 w-4" />}
                            title={group.label}
                            subtitle={permissionGroupSubtitle(
                              selected.id,
                              group.key,
                            )}
                            className="admin-product-form-section"
                          >
                            <dl>
                              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                                <dt>Permissions</dt>
                                <dd>
                                  <div className="admin-roles-perm-grid">
                                    {group.permissions.map((perm) => {
                                      const guestStorefrontReadOnly =
                                        group.key === "guest_storefront" &&
                                        selected.id !== "guest";
                                      const enabled = guestStorefrontReadOnly
                                        ? !!guestRoleProfile?.permissions[
                                            perm.key
                                          ]
                                        : !!draft[perm.key];
                                      return (
                                        <PermissionToggle
                                          key={perm.key}
                                          permKey={perm.key}
                                          label={perm.label}
                                          enabled={enabled}
                                          locked={
                                            selected.locked ||
                                            guestStorefrontReadOnly
                                          }
                                          onToggle={togglePermission}
                                        />
                                      );
                                    })}
                                  </div>
                                </dd>
                              </div>
                            </dl>
                          </ProductFormOrderCard>
                        ))}
                      </>
                    ) : (
                      <ProductFormOrderCard
                        icon={<ShieldIcon className="h-4 w-4" />}
                        title="Select a role"
                        subtitle={
                          coreLoading
                            ? "Loading roles…"
                            : "Choose a role from the list to edit permissions."
                        }
                        className="admin-product-form-section"
                      >
                        <p className="text-sm text-subtle">
                          Pick a role profile on the left to view and edit its
                          permissions.
                        </p>
                      </ProductFormOrderCard>
                    )}
                  </div>
                </div>

                <ProductFormOrderCard
                  className="admin-product-form-section admin-roles-help"
                  icon={<ShieldIcon className="h-4 w-4" />}
                  title="Roles guide"
                  subtitle="Hierarchy, customization, and access."
                >
                  <dl>
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Role hierarchy</dt>
                      <dd className="text-sm text-foreground-muted">
                        Shop Manager through Editor can be tuned per permission.
                        Guest controls storefront limits for anonymous and
                        ephemeral sessions. Administrator is locked with full
                        access.
                      </dd>
                    </div>
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Customized roles</dt>
                      <dd className="text-sm text-foreground-muted">
                        A role marked customized differs from the platform default.
                        Reset role restores defaults without affecting other roles.
                      </dd>
                    </div>
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Admin panel access</dt>
                      <dd className="text-sm text-foreground-muted">
                        Disable admin panel access to keep a role storefront-only.
                        Security settings require{" "}
                        <Link
                          href="/admin/settings/security"
                          className="text-accent hover:underline"
                        >
                          manage_security_settings
                        </Link>
                        .
                      </dd>
                    </div>
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Customers</dt>
                      <dd className="text-sm text-foreground-muted">
                        Assign roles to staff under{" "}
                        <Link
                          href="/admin/customers"
                          className="text-accent hover:underline"
                        >
                          Customers
                        </Link>{" "}
                        after saving permission profiles here.
                      </dd>
                    </div>
                  </dl>
                </ProductFormOrderCard>
          </div>
        </>
      )}
    </AdminPageLayout>
  );
}
