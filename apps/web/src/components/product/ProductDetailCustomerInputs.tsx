"use client";

import { KeyIcon } from "@/components/admin/icons";
import { productInputCls } from "@/components/admin/product-form";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import type { CustomerInputBox } from "@/lib/product-page";

type Props = {
  inputs: CustomerInputBox[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onFocus?: () => void;
};

export function ProductDetailCustomerInputs({
  inputs,
  values,
  onChange,
  onFocus,
}: Props) {
  if (inputs.length === 0) return null;

  return (
    <div className="customer-panel min-w-0">
      <ProductFormOrderCard
        className="admin-product-form-section product-pdp-customer-inputs"
        icon={<KeyIcon className="h-4 w-4" strokeWidth={2} aria-hidden />}
        title="Your information"
        flatBody
      >
        <div className="product-pdp-customer-input-fields space-y-4">
          {inputs.map((box) => {
            const fieldId = `product-customer-input-${box.id}`;
            return (
              <div key={box.id}>
                <label
                  className="product-pdp-customer-input-label"
                  htmlFor={fieldId}
                >
                  {box.label}
                  {box.required ? (
                    <span className="text-danger"> *</span>
                  ) : null}
                </label>
                <input
                  id={fieldId}
                  type="text"
                  value={values[box.id] ?? ""}
                  onChange={(e) => onChange(box.id, e.target.value)}
                  onFocus={onFocus}
                  placeholder={box.placeholder}
                  className={productInputCls}
                  required={box.required}
                />
              </div>
            );
          })}
        </div>
      </ProductFormOrderCard>
    </div>
  );
}
