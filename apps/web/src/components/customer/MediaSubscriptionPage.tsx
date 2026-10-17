"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { hasAuthSession } from "@/lib/access-token";
import {
  formatMediaPlanCents,
  mediaSubscriptionApi,
} from "@/lib/media-subscription-api";
import {
  BILLING_CYCLES,
  BillingCycle,
  PLAN_TIERS,
  SubscriptionStatus,
  type PublicPlan,
  type PublicSubscription,
} from "@/lib/media-subscription-types";

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function planFeatures(plan: PublicPlan): string[] {
  if (plan.featureBullets?.length) return plan.featureBullets;
  const lines: string[] = [];
  lines.push(`${plan.maxVideoQuality.toUpperCase()} streaming`);
  lines.push(`${plan.maxStreams} stream${plan.maxStreams === 1 ? "" : "s"} · ${plan.maxDevices} devices`);
  if (plan.trialDays > 0) lines.push(`${plan.trialDays}-day free trial`);
  return lines;
}

export function MediaSubscriptionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>(BillingCycle.Monthly);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAuthSession()) {
      router.replace("/login?next=/dashboard/subscription");
    }
  }, [router]);

  const plansQuery = useQuery({
    queryKey: ["media-plans-public"],
    queryFn: mediaSubscriptionApi.publicPlans,
  });

  const meQuery = useQuery({
    queryKey: ["media-subscription-me"],
    queryFn: mediaSubscriptionApi.me,
    enabled: hasAuthSession(),
  });

  const historyQuery = useQuery({
    queryKey: ["media-subscription-history"],
    queryFn: mediaSubscriptionApi.history,
    enabled: hasAuthSession(),
  });

  const sub = meQuery.data?.subscription;
  const entitled = Boolean(meQuery.data?.entitlement?.entitled);

  useEffect(() => {
    if (sub?.billingCycle) setCycle(sub.billingCycle);
  }, [sub?.billingCycle]);

  const cancel = useMutation({
    mutationFn: mediaSubscriptionApi.cancel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["media-subscription-me"] });
      await queryClient.invalidateQueries({ queryKey: ["media-subscription-history"] });
    },
  });

  const resume = useMutation({
    mutationFn: mediaSubscriptionApi.resume,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["media-subscription-me"] });
    },
  });

  const start = useMutation({
    mutationFn: ({ slug }: { slug: string }) => mediaSubscriptionApi.start(slug, cycle),
    onSuccess: async () => {
      setPlanError(null);
      await queryClient.invalidateQueries({ queryKey: ["media-subscription-me"] });
      await queryClient.invalidateQueries({ queryKey: ["media-subscription-history"] });
    },
    onError: (err: unknown) => {
      setPlanError(err instanceof Error ? err.message : "Could not start subscription.");
    },
  });

  const change = useMutation({
    mutationFn: ({ slug }: { slug: string }) => mediaSubscriptionApi.change(slug, cycle),
    onSuccess: async () => {
      setPlanError(null);
      await queryClient.invalidateQueries({ queryKey: ["media-subscription-me"] });
    },
    onError: (err: unknown) => {
      setPlanError(err instanceof Error ? err.message : "Could not change plan.");
    },
  });

  const plans = useMemo(
    () => [...(plansQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [plansQuery.data],
  );

  const handleSelect = (slug: string) => {
    setPlanError(null);
    if (sub) change.mutate({ slug });
    else start.mutate({ slug });
  };

  const busy = start.isPending || change.isPending;
  const loading = meQuery.isLoading || plansQuery.isLoading;

  return (
    <CustomerPageLayout
      section="Account"
      title="Movie Server subscription"
      description="Choose a plan, manage renewal, and stream from the media library."
      iconKey="movie_subscription"
      loading={loading}
      action={
        entitled ? (
          <Link
            href="/media"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
          >
            Open Movie Server
          </Link>
        ) : null
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        {sub ? (
          <StatusBar sub={sub} entitled={entitled} cancel={cancel} resume={resume} />
        ) : (
          <div className="rounded-xl border border-border bg-elevated p-6 text-center">
            <p className="text-lg font-semibold text-foreground">No subscription yet</p>
            <p className="mt-2 text-sm text-foreground-muted">
              Pick a plan below. Trial applies when available; otherwise the fee is charged from your
              wallet balance.
            </p>
            <Link href="/wallet" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
              Top up wallet
            </Link>
          </div>
        )}

        <section aria-labelledby="media-plans-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="media-plans-heading" className="text-lg font-semibold text-foreground">
                Plans
              </h2>
              <p className="text-sm text-foreground-muted">
                Monthly or yearly billing — your current plan is highlighted.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Billing cycle">
              {BILLING_CYCLES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                    cycle === item ? "bg-brand text-white" : "text-foreground-muted hover:text-foreground"
                  }`}
                  onClick={() => setCycle(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {planError ? (
            <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {planError}
            </p>
          ) : null}

          {plans.length === 0 ? (
            <p className="text-sm text-foreground-muted">No plans are available right now.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = sub?.plan.slug === plan.slug;
                const price =
                  cycle === BillingCycle.Yearly ? plan.yearlyPriceCents : plan.monthlyPriceCents;
                const featured = plan.tier === PLAN_TIERS[1];
                return (
                  <article
                    key={plan.id}
                    className={`flex flex-col rounded-xl border p-5 ${
                      isCurrent ? "border-brand ring-1 ring-brand/40" : "border-border bg-elevated"
                    }`}
                  >
                    {featured ? (
                      <span className="mb-2 w-fit rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
                        Popular
                      </span>
                    ) : null}
                    <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {formatMediaPlanCents(price, plan.currency)}
                      <span className="text-sm font-normal text-foreground-muted">
                        /{cycle === BillingCycle.Yearly ? "yr" : "mo"}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-foreground-muted">{plan.description}</p>
                    <ul className="mt-4 flex-1 space-y-1.5 text-sm text-foreground-muted">
                      {planFeatures(plan).map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={busy || isCurrent}
                      className="mt-5 w-full rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleSelect(plan.slug)}
                    >
                      {isCurrent ? "Your plan" : sub ? "Switch plan" : "Subscribe"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <HistoryBlock title="Subscription activity" events={historyQuery.data?.events ?? []} />
      </div>
    </CustomerPageLayout>
  );
}

function StatusBar({
  sub,
  entitled,
  cancel,
  resume,
}: {
  sub: PublicSubscription;
  entitled: boolean;
  cancel: { mutate: () => void; isPending: boolean };
  resume: { mutate: () => void; isPending: boolean };
}) {
  return (
    <section className="rounded-xl border border-border bg-elevated p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand">You are on {sub.plan.name}</p>
          <p className="mt-1 text-sm text-foreground-muted">
            <span className="capitalize">{formatStatus(sub.status)}</span>
            {" · "}
            {formatMediaPlanCents(sub.priceCents, sub.currency)}
            {" · "}
            <span className="capitalize">{sub.billingCycle}</span>
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            Period ends {new Date(sub.currentPeriodEnd).toLocaleString()}
            {sub.trialEnd ? <> · Trial ends {new Date(sub.trialEnd).toLocaleString()}</> : null}
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
            entitled ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-foreground-muted"
          }`}
        >
          {entitled ? "Streaming active" : "No access"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {sub.status === SubscriptionStatus.Cancelled ? (
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
            disabled={resume.isPending}
            onClick={() => resume.mutate()}
          >
            Resume subscription
          </button>
        ) : sub.status !== SubscriptionStatus.Pending ? (
          <button
            type="button"
            className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm font-medium text-rose-300 hover:bg-rose-500/10"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            Cancel at period end
          </button>
        ) : null}
      </div>
    </section>
  );
}

function HistoryBlock({
  title,
  events,
}: {
  title: string;
  events: { id: string; type: string; note: string | null; createdAt: string; toPlanSlug: string | null }[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-foreground-muted">No events yet.</p>
      ) : (
        <ol className="space-y-3 border-l border-border pl-4">
          {events.map((event) => (
            <li key={event.id} className="text-sm">
              <p className="font-medium capitalize text-foreground">
                {event.type.replaceAll("_", " ")}
              </p>
              {event.toPlanSlug ? (
                <p className="text-foreground-muted">Plan: {event.toPlanSlug}</p>
              ) : null}
              <p className="text-foreground-muted">{new Date(event.createdAt).toLocaleString()}</p>
              {event.note ? <p className="text-foreground-muted">{event.note}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
