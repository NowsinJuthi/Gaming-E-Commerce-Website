import {
  DEFAULT_CURRENCY,
  formatPrice,
  formatPriceAmount,
  resolveCurrency,
} from "@/lib/api";
import { TakaIcon } from "@/components/ui/TakaIcon";

type PriceTextProps = {
  amount: number | null | undefined;
  currency?: string | null;
  className?: string;
  prefix?: string;
  suffix?: string;
};

export function PriceText({
  amount,
  currency = DEFAULT_CURRENCY,
  className,
  prefix = "",
  suffix = "",
}: PriceTextProps) {
  const code = resolveCurrency(currency);

  if (code === "BDT") {
    return (
      <span className={["price-formatted", className].filter(Boolean).join(" ")}>
        {prefix}
        <span className="price-amount-line">
          <span className="price-value">
            {formatPriceAmount(amount, currency ?? undefined)}
          </span>
          <span className="price-taka" aria-label="BDT">
            <TakaIcon className="price-taka-icon" />
          </span>
        </span>
        {suffix}
      </span>
    );
  }

  return (
    <span className={className}>
      {prefix}
      {formatPrice(amount, currency ?? undefined)}
      {suffix}
    </span>
  );
}
