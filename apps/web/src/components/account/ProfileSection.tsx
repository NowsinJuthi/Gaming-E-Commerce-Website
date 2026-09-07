"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMe,
  removeProfileAvatar,
  updateProfile,
  uploadProfileAvatar,
  type ProfileUpdate,
  type UserProfile,
} from "@/lib/api";
import { resolveAvatarSrc } from "@/lib/site-appearance";

const FIELDS: Array<{
  key: keyof ProfileUpdate;
  label: string;
  placeholder?: string;
  full?: boolean;
  multiline?: boolean;
}> = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "displayName", label: "Display name" },
  { key: "phone", label: "Phone" },
  { key: "country", label: "Country (2-letter)", placeholder: "BD" },
  { key: "locale", label: "Locale", placeholder: "en" },
  { key: "timezone", label: "Timezone", placeholder: "Asia/Dhaka" },
  { key: "bio", label: "Bio", full: true, multiline: true },
];

function profileToForm(me: UserProfile): ProfileUpdate {
  return {
    firstName: me.profile?.firstName ?? "",
    lastName: me.profile?.lastName ?? "",
    displayName: me.profile?.displayName ?? "",
    phone: me.phone ?? "",
    country: me.profile?.country ?? "",
    locale: me.profile?.locale ?? "",
    timezone: me.profile?.timezone ?? "",
    bio: me.profile?.bio ?? "",
  };
}

export function profileDisplayName(me: UserProfile): string {
  return (
    me.profile?.displayName ||
    [me.profile?.firstName, me.profile?.lastName].filter(Boolean).join(" ") ||
    me.email.split("@")[0] ||
    "Account"
  );
}

function notifyAuthChange() {
  window.dispatchEvent(new Event("auth-change"));
}

type ProfileSectionProps = {
  providedProfile?: UserProfile | null;
  providedLoading?: boolean;
  /** Flat layout when nested inside the profile page card. */
  embedded?: boolean;
};

export function ProfileSection({
  providedProfile,
  providedLoading,
  embedded = false,
}: ProfileSectionProps = {}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileUpdate>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  const useExternalData =
    providedProfile !== undefined || providedLoading !== undefined;

  useEffect(() => {
    if (useExternalData) {
      setLoading(providedLoading ?? false);
      if (providedProfile) {
        setProfile(providedProfile);
        setForm(profileToForm(providedProfile));
      } else if (!providedLoading) {
        setProfile(null);
      }
      return;
    }

    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        setProfile(me);
        setForm(profileToForm(me));
      })
      .catch((e) => {
        if (cancelled) return;
        setMsg({ type: "err", text: e instanceof Error ? e.message : "Error" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [providedLoading, providedProfile, useExternalData]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const payload: ProfileUpdate = {};
      for (const f of FIELDS) {
        const value = String(form[f.key] ?? "").trim();
        if (value) {
          payload[f.key] = value;
        }
      }
      const updated = await updateProfile(payload);
      setProfile(updated);
      setForm(profileToForm(updated));
      setMsg({ type: "ok", text: "Profile updated successfully." });
      notifyAuthChange();
    } catch (err) {
      setMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Update failed",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarSelected(file: File | null) {
    if (!file) return;
    setMsg(null);
    setAvatarBusy(true);
    try {
      const updated = await uploadProfileAvatar(file);
      setProfile(updated);
      setMsg({ type: "ok", text: "Profile photo updated." });
      notifyAuthChange();
    } catch (err) {
      setMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onRemoveAvatar() {
    if (!profile?.profile?.avatarUrl) return;
    setMsg(null);
    setAvatarBusy(true);
    try {
      const updated = await removeProfileAvatar();
      setProfile(updated);
      setMsg({ type: "ok", text: "Profile photo removed." });
      notifyAuthChange();
    } catch (err) {
      setMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Remove failed",
      });
    } finally {
      setAvatarBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-pro-empty p-10">
        <p className="text-sm text-subtle">Loading profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="dashboard-pro-empty py-8">
        <p className="text-sm font-medium text-foreground">
          {msg?.text ?? "Could not load profile."}
        </p>
      </div>
    );
  }

  const avatarUrl = profile.profile?.avatarUrl ?? "";
  const resolvedAvatar = avatarUrl ? resolveAvatarSrc(avatarUrl) : "";
  const initial = profileDisplayName(profile).charAt(0).toUpperCase();

  return (
    <div
      className={`w-full space-y-4 sm:space-y-5${embedded ? " customer-profile-form-stack" : ""}`}
    >
      {embedded ? null : (
        <div className="shell-panel p-5">
          <p className="text-sm font-semibold text-foreground">{profile.email}</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Roles: {profile.roles?.join(", ") || "customer"} · Status:{" "}
            {profile.status} ·{" "}
            {profile.emailVerified ? "Email verified" : "Email not verified"}
          </p>
        </div>
      )}

      {msg ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border border-brand/30 bg-brand/10 text-brand"
              : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      <div
        className={
          embedded
            ? "customer-profile-avatar-panel"
            : "shell-panel p-5"
        }
      >
        <div className="profile-avatar-upload">
          <div className="profile-avatar-preview" aria-hidden>
            {resolvedAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedAvatar}
                alt=""
                className="profile-avatar-preview-img"
              />
            ) : (
              <span className="profile-avatar-preview-fallback">{initial}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Profile photo</p>
            <p className="mt-1 text-xs text-foreground-muted">
              JPG, PNG, WebP, or GIF · up to 2 MB · optimized for sharp display
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={avatarBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void onAvatarSelected(file);
                }}
              />
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary btn-primary-sm disabled:opacity-50"
              >
                {avatarBusy ? "Uploading…" : "Upload photo"}
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => void onRemoveAvatar()}
                  className="dashboard-pro-btn-ghost px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={onSave}
        className={
          embedded
            ? "customer-profile-form-panel w-full space-y-4 sm:space-y-5"
            : "shell-panel w-full space-y-5 p-5"
        }
      >
        <div className="customer-profile-form-grid grid w-full gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((f) => {
            const inputId = `profile-${f.key}`;
            return (
              <div
                key={f.key}
                className={
                  f.full ? "sm:col-span-2 lg:col-span-3" : ""
                }
              >
                <label htmlFor={inputId} className="admin-filter-label">
                  {f.label}
                </label>
                {f.multiline ? (
                  <textarea
                    id={inputId}
                    value={(form[f.key] as string) ?? ""}
                    placeholder={f.placeholder}
                    rows={4}
                    onChange={(e) =>
                      setForm((cur) => ({ ...cur, [f.key]: e.target.value }))
                    }
                    className="admin-input mt-1 w-full resize-y"
                  />
                ) : (
                  <input
                    id={inputId}
                    type={f.key === "phone" ? "tel" : "text"}
                    value={(form[f.key] as string) ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setForm((cur) => ({ ...cur, [f.key]: e.target.value }))
                    }
                    className="admin-input mt-1 w-full"
                  />
                )}
              </div>
            );
          })}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full sm:w-auto disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
