"use client";

import { BoxIcon, TruckIcon, ZapIcon } from "@/components/admin/icons";

function isPubgProduct(title: string, slug?: string) {
  return /pubg/i.test(title) || (slug ? /pubg/i.test(slug) : false);
}

function PubgCoinIcon() {
  return (
    <svg
      className="order-delivery-pubg-icon"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="16" cy="16" r="11" fill="url(#pubgCoin)" />
      <circle
        cx="16"
        cy="16"
        r="10"
        stroke="rgb(255 255 255 / 0.35)"
        strokeWidth="1"
      />
      <path
        d="M11.5 16.2c0-2.4 2-4.3 4.5-4.3s4.5 1.9 4.5 4.3c0 2.1-1.4 3.4-2.6 4.1-.6.4-1.2.6-1.9.6s-1.3-.2-1.9-.6c-1.2-.7-2.6-2-2.6-4.1Z"
        fill="rgb(255 255 255 / 0.92)"
      />
      <path
        d="M13.2 15.8h5.6M13.2 18.1h3.8"
        stroke="rgb(180 83 9)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="pubgCoin" x1="8" y1="6" x2="24" y2="26">
          <stop stopColor="#fcd34d" />
          <stop offset="0.55" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type Props = {
  title: string;
  slug?: string;
  deliveryType?: string;
  variant?: "delivery" | "recent-order";
  plain?: boolean;
  imageUrl?: string;
};

export function OrderDeliveryProductIcon({
  title,
  slug,
  deliveryType,
  variant = "delivery",
  plain = false,
  imageUrl,
}: Props) {
  const pubg = isPubgProduct(title, slug);

  if (variant === "recent-order") {
    const isManual = deliveryType === "manual";

    return (
      <span
        className="dashboard-recent-order-icon"
        aria-hidden
        title={isManual ? "Manual delivery" : "Auto delivery"}
      >
        {isManual ? (
          <TruckIcon className="h-4 w-4" />
        ) : (
          <ZapIcon className="h-4 w-4" />
        )}
      </span>
    );
  }

  if (imageUrl) {
    return (
      <span
        className={`order-delivery-product-thumb${plain ? " order-delivery-product-thumb--plain" : ""}`}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }

  if (plain) {
    return (
      <span className="order-delivery-card-icon" aria-hidden>
        <BoxIcon className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span
      className={`order-delivery-card-icon${pubg ? " order-delivery-card-icon--pubg" : ""}`}
      aria-hidden
    >
      {pubg ? <PubgCoinIcon /> : <BoxIcon className="h-4 w-4" />}
    </span>
  );
}
