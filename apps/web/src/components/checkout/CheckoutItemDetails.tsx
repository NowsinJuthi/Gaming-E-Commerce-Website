import { KeyIcon, LockIcon, TagIcon } from "@/components/admin/icons";
import { PriceText } from "@/components/ui/PriceText";
import type { CartCustomerInput } from "@/lib/api";
import type { ReactNode } from "react";

type HeaderProps = {
  title: ReactNode;
};

type ExtrasProps = {
  customerInputs?: CartCustomerInput[];
  packageName?: string;
  unitPrice: number;
  lineTotal: number;
  currency: string;
};

type Props = HeaderProps & ExtrasProps;

function isPasswordField(label: string) {
  const normalized = label.toLowerCase();
  return /password|pass|পাস/.test(normalized);
}

function CustomerFieldIcon({ label }: { label: string }) {
  const Icon = isPasswordField(label) ? LockIcon : KeyIcon;
  return <Icon className="checkout-item-field-icon" aria-hidden />;
}

export function CheckoutItemHeader({ title }: HeaderProps) {
  return (
    <div className="checkout-item-header">
      <div className="checkout-item-title">{title}</div>
    </div>
  );
}

export function CheckoutItemPackageRow({
  packageName,
  unitPrice,
  currency,
}: {
  packageName: string;
  unitPrice: number;
  currency: string;
}) {
  return (
    <div className="checkout-item-package-badge">
      <span className="checkout-item-package-main">
        <TagIcon className="checkout-item-package-icon" aria-hidden />
        <span className="checkout-item-package-text">{packageName}</span>
      </span>
      <span className="checkout-item-package-price">
        <PriceText amount={unitPrice} currency={currency} />
      </span>
    </div>
  );
}

export function CheckoutItemExtras({
  customerInputs,
  packageName,
  unitPrice,
  lineTotal,
  currency,
}: ExtrasProps) {
  const showFieldsPanel =
    Boolean(packageName) ||
    Boolean(customerInputs && customerInputs.length > 0);

  return (
    <div className="checkout-item-extras">
      {showFieldsPanel ? (
        <div className="checkout-item-fields">
          {packageName ? (
            <CheckoutItemPackageRow
              packageName={packageName}
              unitPrice={unitPrice}
              currency={currency}
            />
          ) : null}

          {customerInputs?.map((field, i) => (
            <div
              key={i}
              className={`checkout-item-field${isPasswordField(field.label) ? " checkout-item-field--secret" : ""}`}
            >
              <div className="checkout-item-field-head">
                <CustomerFieldIcon label={field.label} />
                <p className="checkout-item-field-label">{field.label}</p>
              </div>
              <p className="checkout-item-field-value">{field.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="checkout-item-pricing">
        {!packageName ? (
          <p className="checkout-item-unit-price">
            <PriceText amount={unitPrice} currency={currency} />
            <span className="checkout-item-unit-suffix">each</span>
          </p>
        ) : (
          <span className="checkout-item-pricing-label">Amount</span>
        )}

        <p className="checkout-item-line-total">
          <PriceText amount={lineTotal} currency={currency} />
        </p>
      </div>
    </div>
  );
}

export function CheckoutItemDetails({
  title,
  packageName,
  customerInputs,
  unitPrice,
  lineTotal,
  currency,
}: Props) {
  return (
    <>
      <CheckoutItemHeader title={title} />
      <CheckoutItemExtras
        customerInputs={customerInputs}
        packageName={packageName}
        unitPrice={unitPrice}
        lineTotal={lineTotal}
        currency={currency}
      />
    </>
  );
}
