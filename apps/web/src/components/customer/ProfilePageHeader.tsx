"use client";

import Link from "next/link";
import { profileDisplayName } from "@/components/account/ProfileSection";
import type { UserProfile } from "@/lib/api";
import { resolveAvatarSrc } from "@/lib/site-appearance";

type Props = {
  profile: UserProfile | null;
  loading?: boolean;
};

export function ProfilePageHeader({ profile, loading }: Props) {
  const welcomeName = profile
    ? profile.profile?.firstName ?? profile.email?.split("@")[0] ?? "there"
    : "there";
  const displayName = profile ? profileDisplayName(profile) : welcomeName;
  const avatarUrl = profile?.profile?.avatarUrl ?? "";
  const resolvedAvatar = avatarUrl ? resolveAvatarSrc(avatarUrl) : "";
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <article className="customer-profile-header-card">
      <div className="customer-profile-header-glow" aria-hidden />

      <section className="customer-profile-header-main">
        <div className="customer-profile-header-row">
          <span
            className={`customer-profile-header-avatar${
              resolvedAvatar ? " customer-profile-header-avatar--photo" : ""
            }`}
            aria-hidden={!resolvedAvatar}
          >
            {loading ? (
              "…"
            ) : resolvedAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedAvatar}
                alt={`${displayName} profile photo`}
                className="customer-profile-header-avatar-img"
              />
            ) : (
              avatarInitial
            )}
          </span>
          <div className="min-w-0 flex-1">
            {loading ? (
              <>
                <p className="customer-profile-header-kicker">Profile Settings</p>
                <p className="customer-profile-header-sub">Loading profile…</p>
              </>
            ) : (
              <>
                <p className="customer-profile-header-kicker">Profile Settings</p>
                <h1 className="customer-profile-header-title">
                  Welcome, {welcomeName}
                </h1>
              </>
            )}
          </div>
        </div>
      </section>

      {profile ? (
        <section
          className="customer-profile-header-actions"
          aria-label="Profile status and navigation"
        >
          <Link
            href="/dashboard"
            className="customer-dashboard-mobile-chip customer-dashboard-mobile-chip--store"
          >
            ← Dashboard
          </Link>
          <span
            className={`customer-dashboard-mobile-chip ${
              profile.emailVerified
                ? "customer-dashboard-mobile-chip--green"
                : "customer-dashboard-mobile-chip--amber"
            }`}
          >
            {profile.emailVerified ? "Email verified" : "Email not verified"}
          </span>
          <span className="customer-dashboard-mobile-chip customer-dashboard-mobile-chip--brand capitalize">
            {profile.status}
          </span>
        </section>
      ) : null}
    </article>
  );
}
