"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, CopyIcon, CheckIcon } from "@/components/admin/icons";
import { PriceText } from "@/components/ui/PriceText";
import { adminGetCustomer, type AdminCustomerRow } from "@/lib/api";
import { getCustomerDisplayName } from "@/lib/admin-order-view";
import { resolveAvatarSrc } from "@/lib/site-appearance";

function chatCustomerInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (name.trim()[0] ?? "?").toUpperCase();
}

type Props = {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
  fallback?: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
};

export function ChatCustomerInfoDialog({
  customerId,
  open,
  onClose,
  fallback,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<AdminCustomerRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !customerId) {
      setCustomer(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminGetCustomer(customerId)
      .then((row) => {
        if (!cancelled) setCustomer(row);
      })
      .catch((err) => {
        if (!cancelled) {
          setCustomer(null);
          setError(
            err instanceof Error ? err.message : "Could not load customer",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch {
      /* ignore */
    }
  }

  if (!open || !mounted || !customerId) return null;

  const displayName = customer
    ? getCustomerDisplayName(customer)
    : fallback?.displayName?.trim() || fallback?.email?.trim() || "Customer";
  const email = customer?.email ?? fallback?.email ?? "";
  const avatarUrl = customer?.profile?.avatarUrl ?? fallback?.avatarUrl;
  const phone = customer?.phone?.trim() || "—";
  const roles = customer?.roles?.join(", ") || "—";
  const status = customer?.status ?? "—";
  const walletBalance = customer?.wallet?.balance;
  const walletCurrency = customer?.wallet?.currency ?? "BDT";
  const joined = customer?.createdAt
    ? new Date(customer.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const overlay = createPortal(
    <div
      className="admin-chat-customer-info-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-chat-customer-info-title"
    >
      <button
        type="button"
        className="admin-chat-customer-info-backdrop"
        aria-label="Close customer info"
        onClick={onClose}
      />
      <section className="admin-chat-customer-info">
        <header className="admin-chat-customer-info-head">
          <h2 id="admin-chat-customer-info-title" className="admin-chat-customer-info-title">
            Customer info
          </h2>
          <button
            type="button"
            className="admin-chat-messenger-close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="admin-chat-customer-info-body">
          <div className="admin-chat-customer-info-profile">
            <span className="admin-chat-customer-info-avatar" aria-hidden>
              {avatarUrl ? (
                <Image
                  src={resolveAvatarSrc(avatarUrl)}
                  alt=""
                  width={72}
                  height={72}
                  className="admin-chat-customer-info-avatar-img"
                  unoptimized
                />
              ) : (
                <span className="admin-chat-customer-info-avatar-fallback">
                  {chatCustomerInitial(displayName)}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="admin-chat-customer-info-name">{displayName}</p>
              {email ? (
                <div className="admin-chat-customer-info-email-row">
                  <p className="admin-chat-customer-info-email">{email}</p>
                  <button
                    type="button"
                    className={`admin-chat-header-email-copy${
                      copiedField === "email"
                        ? " admin-chat-header-email-copy--copied"
                        : ""
                    }`}
                    onClick={() => void copyValue("email", email)}
                    aria-label={copiedField === "email" ? "Email copied" : "Copy email"}
                    title={copiedField === "email" ? "Copied!" : "Copy email"}
                  >
                    {copiedField === "email" ? (
                      <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <CopyIcon className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {loading ? (
            <p className="admin-chat-customer-info-muted">Loading customer…</p>
          ) : error ? (
            <p className="admin-chat-customer-info-error">{error}</p>
          ) : customer ? (
            <dl className="admin-chat-customer-info-grid">
              <div>
                <dt>Phone</dt>
                <dd>{phone}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd className="capitalize">{status}</dd>
              </div>
              <div>
                <dt>Roles</dt>
                <dd>{roles}</dd>
              </div>
              <div>
                <dt>Wallet</dt>
                <dd>
                  {typeof walletBalance === "number" ? (
                    <PriceText amount={walletBalance} currency={walletCurrency} />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{joined}</dd>
              </div>
              <div>
                <dt>Email verified</dt>
                <dd>{customer.emailVerified ? "Yes" : "No"}</dd>
              </div>
              {customer.kycStatus ? (
                <div>
                  <dt>KYC</dt>
                  <dd className="capitalize">{customer.kycStatus}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {customer?.adminNote?.trim() ? (
            <div className="admin-chat-customer-info-note">
              <p className="admin-chat-customer-info-note-label">Admin note</p>
              <p className="admin-chat-customer-info-note-body">
                {customer.adminNote.trim()}
              </p>
            </div>
          ) : null}
        </div>

        <footer className="admin-chat-customer-info-foot">
          <Link
            href={`/admin/customers?q=${encodeURIComponent(email || displayName)}`}
            className="admin-chat-customer-info-link"
            onClick={onClose}
          >
            Open in Customers
          </Link>
        </footer>
      </section>
    </div>,
    document.body,
  );

  return overlay;
}
