"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { SubscribePricingSection } from "@/components/customer/media-subscription/subscribe-pricing-section";
import themeStyles from "@/components/customer/media-subscription/media-subscription-theme.module.css";
import styles from "@/components/customer/media-subscription/subscription-page.module.css";
import { hasAuthSession } from "@/lib/access-token";
import {
  formatMediaPlanCents,
  mediaSubscriptionApi,
} from "@/lib/media-subscription-api";
import {
  BillingCycle,
  SubscriptionStatus,
  type PublicSubscription,
} from "@/lib/media-subscription-types";

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="13" r="1.25" fill="currentColor" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M8 5v14l11-7L8 5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MediaSubscriptionPage() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>(BillingCycle.Monthly);
  const [planError, setPlanError] = useState<string | null>(null);

  const loginNext = encodeURIComponent(pathname || "/dashboard/subscription");

  useEffect(() => {
    if (!hasAuthSession()) {
      router.replace(`/login?next=${loginNext}`);
    }
  }, [router, loginNext]);

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

  const changesQuery = useQuery({
    queryKey: ["media-subscription-changes"],
    queryFn: mediaSubscriptionApi.changes,
    enabled: hasAuthSession(),
  });

  const sub = meQuery.data?.subscription;
  const entitlement = meQuery.data?.entitlement;

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
      setPlanError(err instanceof Error ? err.message : "Unable to start a subscription.");
    },
  });

  const change = useMutation({
    mutationFn: ({ slug }: { slug: string }) => mediaSubscriptionApi.change(slug, cycle),
    onSuccess: async () => {
      setPlanError(null);
      await queryClient.invalidateQueries({ queryKey: ["media-subscription-me"] });
      await queryClient.invalidateQueries({ queryKey: ["media-subscription-changes"] });
    },
    onError: (err: unknown) => {
      setPlanError(err instanceof Error ? err.message : "Unable to change plan.");
    },
  });

  const plans = useMemo(
    () => [...(plansQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [plansQuery.data],
  );

  const handleSelectPlan = (slug: string) => {
    setPlanError(null);
    if (sub) change.mutate({ slug });
    else start.mutate({ slug });
  };

  const manageError =
    cancel.error instanceof Error
      ? cancel.error.message
      : resume.error instanceof Error
        ? resume.error.message
        : null;

  const loading = meQuery.isLoading || plansQuery.isLoading;

  return (
    <CustomerPageLayout
      section="Account"
      title="Subscription"
      description="Your plan, renewal dates, and switches — all on one page."
      iconKey="movie_subscription"
      loading={loading}
      loadingText="Loading subscription…"
      action={
        <div className={cn(themeStyles.root, styles.quickLinks)}>
          <Link href="/wallet" className={styles.quickLink}>
            <WalletIcon className="h-3.5 w-3.5" />
            Wallet
          </Link>
          <Link href="/media" className={styles.quickLink}>
            <PlayIcon className="h-3.5 w-3.5" />
            Movie Server
          </Link>
        </div>
      }
    >
      <div className={cn(themeStyles.root, styles.wrap)}>
        {manageError ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {manageError}
          </p>
        ) : null}

        {sub ? (
          <SubscriptionStatusBar
            sub={sub}
            entitled={Boolean(entitlement?.entitled)}
            cancel={cancel}
            resume={resume}
          />
        ) : (
          <section className={styles.emptyCard}>
            <CreditCardIcon className="mx-auto h-10 w-10 text-[var(--primary)]" />
            <h2 className={styles.emptyTitle}>No subscription yet</h2>
            <p className={styles.emptyLead}>
              Choose a plan below — the card you pick becomes your account plan after checkout.
            </p>
          </section>
        )}

        {plansQuery.isLoading ? (
          <p className="text-center text-sm text-foreground-muted">Loading plans…</p>
        ) : plans.length === 0 ? (
          <p className="text-center text-sm text-foreground-muted">No plans available yet.</p>
        ) : (
          <SubscribePricingSection
            layout="account"
            plans={plans}
            cycle={cycle}
            onCycleChange={setCycle}
            error={planError}
            currentSlug={sub?.plan.slug}
            entitled={Boolean(entitlement?.entitled)}
            busy={start.isPending || change.isPending}
            onSelectPlan={handleSelectPlan}
          />
        )}

        <HistoryBlock title="Subscription activity" events={historyQuery.data?.events ?? []} />
        <HistoryBlock title="Plan changes" events={changesQuery.data?.events ?? []} />
      </div>
    </CustomerPageLayout>
  );
}

function SubscriptionStatusBar({
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
    <section className={styles.statusBar} aria-label="Current subscription status">
      <div className={styles.statusMain}>
        <p className={styles.statusEyebrow}>
          <span className="text-[var(--primary)]" aria-hidden>
            ✦
          </span>
          You are on {sub.plan.name}
        </p>
        <p className={styles.statusMeta}>
          <span className={cn(styles.statusChip, "capitalize")}>{formatStatus(sub.status)}</span>
          <span className={styles.statusDot} aria-hidden>
            ·
          </span>
          <span>{formatMediaPlanCents(sub.priceCents, sub.currency)}</span>
          <span className={styles.statusDot} aria-hidden>
            ·
          </span>
          <span className="capitalize">{sub.billingCycle} billing</span>
        </p>
        <p className={styles.statusRenewal}>
          Period ends {new Date(sub.currentPeriodEnd).toLocaleString()}
          {sub.trialEnd ? <> · Trial ends {new Date(sub.trialEnd).toLocaleString()}</> : null}
          {sub.scheduledPlanId ? (
            <>
              {" "}
              · Downgrade scheduled{" "}
              {sub.scheduledChangeAt
                ? new Date(sub.scheduledChangeAt).toLocaleString()
                : "at period end"}
            </>
          ) : null}
        </p>
      </div>
      <span
        className={cn(
          styles.statusPill,
          entitled ? styles.statusActive : styles.statusMuted,
        )}
      >
        {entitled ? "Streaming active" : "No access"}
      </span>
      <div className={styles.statusActions}>
        {sub.status === SubscriptionStatus.Pending ? (
          <Link
            href="/wallet"
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90"
          >
            Top up wallet
          </Link>
        ) : null}
        {sub.status === SubscriptionStatus.Suspended || sub.status === SubscriptionStatus.Expired ? (
          <Link
            href="/wallet"
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90"
          >
            Pay to renew
          </Link>
        ) : null}
        {sub.status === SubscriptionStatus.Cancelled ? (
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
            disabled={resume.isPending}
            onClick={() => resume.mutate()}
          >
            Resume subscription
          </button>
        ) : sub.status === SubscriptionStatus.Expired ? (
          <a
            href="#account-plans-heading"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
          >
            Choose a new plan
          </a>
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
  events: {
    id: string;
    type: string;
    note: string | null;
    createdAt: string;
    toPlanSlug: string | null;
  }[];
}) {
  return (
    <section className={styles.historySection}>
      <div className={styles.historyHead}>
        <h2 className={styles.historyTitle}>{title}</h2>
        <span className={styles.historyCount}>{events.length} events</span>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-foreground-muted">No events yet.</p>
      ) : (
        <ol className={styles.timeline}>
          {events.map((event) => (
            <li key={event.id} className={styles.timelineItem}>
              <p className={styles.eventType}>{event.type.replaceAll("_", " ")}</p>
              {event.toPlanSlug ? (
                <p className={styles.eventMeta}>Plan: {event.toPlanSlug}</p>
              ) : null}
              <p className={styles.eventMeta}>{new Date(event.createdAt).toLocaleString()}</p>
              {event.note ? <p className={styles.eventMeta}>{event.note}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
