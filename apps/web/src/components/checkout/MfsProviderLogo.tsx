import type { MfsProviderId } from "@/lib/api";

const BKASH_LOGO_SRC = "/payments/bkash-logo.png";
const NAGAD_LOGO_SRC = "/payments/nagad-logo.png";
const ROCKET_LOGO_SRC = "/payments/rocket-logo.png";

type Props = {
  provider: MfsProviderId | string;
  className?: string;
};

function BkashLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BKASH_LOGO_SRC}
      alt=""
      className="mfs-pay-gateway-logo-img"
    />
  );
}
function NagadLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={NAGAD_LOGO_SRC}
      alt=""
      className="mfs-pay-gateway-logo-img"
    />
  );
}

function RocketLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ROCKET_LOGO_SRC}
      alt=""
      className="mfs-pay-gateway-logo-img"
    />
  );
}

function UpayLogo() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#006A4E" />
      <path
        d="M14.5 30.5V17.5h4l4.5 7.8L27.5 17.5H31.5v13h-3.4v-6.8L24 30.5h-2.2l-4-7.2v7.2h-3.3Z"
        fill="#fff"
      />
      <text
        x="24"
        y="40"
        textAnchor="middle"
        fill="#fff"
        fontSize="8.5"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        Upay
      </text>
    </svg>
  );
}

function GenericWalletLogo() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect
        width="48"
        height="48"
        rx="10"
        fill="rgb(var(--brand) / 0.14)"
        stroke="rgb(var(--brand) / 0.35)"
        strokeWidth="1.5"
      />
      <path
        d="M14 18h20a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V21a3 3 0 0 1 3-3Z"
        stroke="rgb(var(--brand))"
        strokeWidth="2"
      />
      <path
        d="M31 24h5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-5"
        stroke="rgb(var(--brand))"
        strokeWidth="2"
      />
      <circle cx="33" cy="27" r="1.2" fill="rgb(var(--brand))" />
    </svg>
  );
}

export function MfsProviderLogo({ provider, className }: Props) {
  const id = provider.toLowerCase();

  return (
    <span className={className ?? "mfs-pay-gateway-logo"}>
      {id === "bkash" ? (
        <BkashLogo />
      ) : id === "nagad" ? (
        <NagadLogo />
      ) : id === "rocket" ? (
        <RocketLogo />
      ) : id === "upay" ? (
        <UpayLogo />
      ) : (
        <GenericWalletLogo />
      )}
    </span>
  );
}
