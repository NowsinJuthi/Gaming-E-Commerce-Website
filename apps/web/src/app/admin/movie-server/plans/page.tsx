"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
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

  const plans = query.data?.plans ?? [];

  return (
    <AdminPageLayout
      section="Movie Server"
      title="Plans"
      description="Movie server subscription tiers. Prices are stored in minor units (e.g. poisha for BDT). Disabling blocks new signups."
      icon={TagIcon}
      loading={query.isLoading}
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      <form
        className="mb-8 grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-white/70">Description</span>
          <input
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
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
          options={VIDEO_QUALITIES.map((q) => ({ value: q, label: q.toUpperCase() }))}
          onChange={(maxVideoQuality) => setForm({ ...form, maxVideoQuality })}
        />
        <Field
          label="Monthly price (minor units)"
          type="number"
          value={String(form.monthlyPriceCents)}
          onChange={(v) => setForm({ ...form, monthlyPriceCents: Number(v) })}
        />
        <Field
          label="Yearly price (minor units)"
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
        <div className="sm:col-span-2">
          <span className="text-sm text-white/70">Features</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {PLAN_FEATURES.map((feature) => (
              <label key={feature} className="flex items-center gap-2 text-sm">
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
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create plan"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04] text-white/60">
            <tr>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Limits</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{plan.name}</div>
                  <div className="text-white/50">{plan.slug}</div>
                </td>
                <td className="px-4 py-3">
                  {formatMediaPlanCents(plan.monthlyPriceCents, plan.currency)} / mo
                </td>
                <td className="px-4 py-3 text-white/70">
                  {plan.maxVideoQuality.toUpperCase()} · {plan.maxStreams} streams ·{" "}
                  {plan.maxDevices} devices
                </td>
                <td className="px-4 py-3">{plan.isActive ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
                      onClick={() => setEditPlan(plan)}
                    >
                      Edit
                    </button>
                    {plan.isActive ? (
                      <button
                        type="button"
                        className="rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
                        onClick={() => setPendingDisable(plan.id)}
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
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
                <td colSpan={5} className="px-4 py-8 text-center text-white/50">
                  No plans yet. Defaults seed on API startup when the collection is empty.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pendingDisable ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md rounded-xl border border-white/10 bg-[#1a1a24] p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Disable this plan?</h3>
            <p className="mt-2 text-sm text-white/60">
              Existing subscribers keep access. New signups will not see this plan.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm"
                onClick={() => setPendingDisable(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm hover:bg-rose-500 disabled:opacity-50"
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
    <label className="space-y-1 text-sm">
      <span className="text-white/70">{label}</span>
      <input
        type={type}
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
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
    <label className="space-y-1 text-sm">
      <span className="text-white/70">{label}</span>
      <select
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a24] p-5">
        <h3 className="text-lg font-semibold text-white">Edit {plan.slug}</h3>
        <div className="mt-4 space-y-3">
          <Field label="Name" value={name} onChange={setName} />
          <label className="block space-y-1 text-sm">
            <span className="text-white/70">Description</span>
            <textarea
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <Field
            label="Monthly (minor units)"
            type="number"
            value={String(monthly)}
            onChange={(v) => setMonthly(Number(v))}
          />
          <Field
            label="Yearly (minor units)"
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
          <button
            type="button"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm hover:bg-violet-500 disabled:opacity-50"
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
