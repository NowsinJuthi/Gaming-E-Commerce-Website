"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminMediaPlanPackages } from "@/components/admin/media-plans/AdminMediaPlanPackages";
import styles from "@/components/admin/media-plans/admin-media-plans.module.css";
import { TagIcon } from "@/components/admin/icons";
import {
  formatMediaPlanCents,
  mediaSubscriptionApi,
} from "@/lib/media-subscription-api";
import {
  PLAN_FEATURES,
  PLAN_TIERS,
  VIDEO_QUALITIES,
  type PublicPlan,
} from "@/lib/media-subscription-types";

export default function MovieServerPlansPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pendingDisable, setPendingDisable] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState<PublicPlan | null>(null);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    description: "Custom plan",
    tier: "standard",
    monthlyPriceCents: 1299,
    yearlyPriceCents: 12999,
    maxVideoQuality: "hd",
    maxDevices: 2,
    maxStreams: 2,
    trialDays: 0,
    features: ["catalog", "hd"] as string[],
  });

  const query = useQuery({
    queryKey: ["admin-media-plans"],
    queryFn: mediaSubscriptionApi.adminPlans,
  });

  const plans = useMemo(
    () => [...(query.data?.plans ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [query.data?.plans],
  );

  const create = useMutation({
    mutationFn: () =>
      mediaSubscriptionApi.createPlan({
        ...form,
        monthlyPriceCents: Number(form.monthlyPriceCents),
        yearlyPriceCents: Number(form.yearlyPriceCents),
        maxDevices: Number(form.maxDevices),
        maxStreams: Number(form.maxStreams),
        trialDays: Number(form.trialDays),
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-media-plans"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Unable to create plan.");
    },
  });

  const disable = useMutation({
    mutationFn: (id: string) => mediaSubscriptionApi.disablePlan(id),
    onSuccess: async () => {
      setPendingDisable(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-media-plans"] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      mediaSubscriptionApi.updatePlan(id, input),
    onSuccess: async () => {
      setEditPlan(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-media-plans"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Unable to update plan.");
    },
  });

  const enable = useMutation({
    mutationFn: (id: string) => mediaSubscriptionApi.updatePlan(id, { isActive: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-media-plans"] });
    },
  });

  const toggleFeature = (feature: string) => {
    setForm((current) => ({
      ...current,
      features: current.features.includes(feature)
        ? current.features.filter((item) => item !== feature)
        : [...current.features, feature],
    }));
  };

  return (
    <AdminPageLayout
      section="Movie Server"
      title="Subscription plans"
      description="Admin-only plan catalog. Prices are stored in cents. Disabling a plan blocks new signups."
      icon={TagIcon}
      loading={query.isLoading}
    >
      <div className={styles.section}>
        {error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        <AdminMediaPlanPackages plans={plans} />

        <form
          className={`${styles.card} ${styles.formGrid}`}
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <label className="sm:col-span-2">
            <span className={styles.fieldLabel}>Description</span>
            <input
              className={styles.fieldInput}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <SelectField
            label="Tier"
            value={form.tier}
            options={PLAN_TIERS.map((t) => ({ value: t, label: t }))}
            onChange={(tier) => setForm({ ...form, tier })}
          />
          <SelectField
            label="Max quality"
            value={form.maxVideoQuality}
            options={VIDEO_QUALITIES.map((q) => ({ value: q, label: q }))}
            onChange={(maxVideoQuality) => setForm({ ...form, maxVideoQuality })}
          />
          <Field
            label="Monthly price (cents)"
            type="number"
            value={String(form.monthlyPriceCents)}
            onChange={(v) => setForm({ ...form, monthlyPriceCents: Number(v) })}
          />
          <Field
            label="Yearly price (cents)"
            type="number"
            value={String(form.yearlyPriceCents)}
            onChange={(v) => setForm({ ...form, yearlyPriceCents: Number(v) })}
          />
          <Field
            label="Max devices"
            type="number"
            value={String(form.maxDevices)}
            onChange={(v) => setForm({ ...form, maxDevices: Number(v) })}
          />
          <Field
            label="Max streams"
            type="number"
            value={String(form.maxStreams)}
            onChange={(v) => setForm({ ...form, maxStreams: Number(v) })}
          />
          <Field
            label="Trial days"
            type="number"
            value={String(form.trialDays)}
            onChange={(v) => setForm({ ...form, trialDays: Number(v) })}
          />
          <div className={styles.features}>
            <span className={styles.fieldLabel}>Features</span>
            <div className={styles.featureList}>
              {PLAN_FEATURES.map((feature) => (
                <label key={feature} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.features.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  {feature}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={create.isPending} className={styles.primaryBtn}>
              {create.isPending ? "Creating…" : "Create plan"}
            </button>
          </div>
        </form>

        <section className={styles.card}>
          <p className={styles.previewHeading}>Plan catalog</p>
          <p className={styles.mobileHint}>Swipe sideways to see all columns.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Limits</th>
                  <th>Active</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <div className={styles.planTitle}>{plan.name}</div>
                      <div className={styles.planSlug}>{plan.slug}</div>
                    </td>
                    <td className="tabular-nums">
                      {formatMediaPlanCents(plan.monthlyPriceCents, plan.currency)} / mo
                    </td>
                    <td>
                      {plan.maxVideoQuality.toUpperCase()} · {plan.maxStreams} streams ·{" "}
                      {plan.maxDevices} devices
                    </td>
                    <td>{plan.isActive ? "Yes" : "No"}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => setEditPlan(plan)}
                        >
                          Edit
                        </button>
                        {plan.isActive ? (
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            onClick={() => setPendingDisable(plan.id)}
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            disabled={enable.isPending}
                            onClick={() => enable.mutate(plan.id)}
                          >
                            Enable
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!plans.length && !query.isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-foreground-muted">
                      No plans yet. Basic, Standard, and Premium sync on API startup.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {pendingDisable ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md rounded-xl border border-border bg-elevated p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Disable this plan?</h3>
            <p className="mt-2 text-sm text-foreground-muted">
              Existing subscribers keep access. The plan will no longer be offered for new signups.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setPendingDisable(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                disabled={disable.isPending}
                onClick={() => disable.mutate(pendingDisable)}
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editPlan ? (
        <EditPlanModal
          plan={editPlan}
          pending={update.isPending}
          onClose={() => setEditPlan(null)}
          onSave={(input) => update.mutate({ id: editPlan.id, input })}
        />
      ) : null}
    </AdminPageLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        type={type}
        className={styles.fieldInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        className={styles.fieldInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditPlanModal({
  plan,
  pending,
  onClose,
  onSave,
}: {
  plan: PublicPlan;
  pending: boolean;
  onClose: () => void;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description);
  const [monthly, setMonthly] = useState(plan.monthlyPriceCents);
  const [yearly, setYearly] = useState(plan.yearlyPriceCents);
  const [trialDays, setTrialDays] = useState(plan.trialDays);
  const [isActive, setIsActive] = useState(plan.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-elevated p-5">
        <h3 className="text-lg font-semibold text-foreground">Edit {plan.slug}</h3>
        <div className="mt-4 space-y-3">
          <Field label="Name" value={name} onChange={setName} />
          <label className="block">
            <span className={styles.fieldLabel}>Description</span>
            <textarea
              className={styles.fieldInput}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <Field
            label="Monthly price (cents)"
            type="number"
            value={String(monthly)}
            onChange={(v) => setMonthly(Number(v))}
          />
          <Field
            label="Yearly price (cents)"
            type="number"
            value={String(yearly)}
            onChange={(v) => setYearly(Number(v))}
          />
          <Field
            label="Trial days"
            type="number"
            value={String(trialDays)}
            onChange={(v) => setTrialDays(Number(v))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active for new signups
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            className={styles.primaryBtn}
            onClick={() =>
              onSave({
                name: name.trim(),
                description: description.trim(),
                monthlyPriceCents: monthly,
                yearlyPriceCents: yearly,
                trialDays,
                isActive,
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
