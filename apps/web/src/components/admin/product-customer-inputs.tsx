"use client";

import { ProductFormOrderCard } from "@/components/admin/product-form-section";

const inputCls = "admin-input w-full text-foreground placeholder:text-subtle";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

export type CustomerInputBox = {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
};

function newId() {
  return `cib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyCustomerInputBox(): CustomerInputBox {
  return {
    id: newId(),
    label: "",
    placeholder: "",
    required: false,
  };
}

export function parseCustomerInputBoxes(
  attrs?: Record<string, unknown>,
): CustomerInputBox[] {
  const raw = attrs?.customerInputBoxes;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const v = item as Record<string, unknown>;
    return {
      id: `stored-cib-${i}`,
      label: String(v.label ?? ""),
      placeholder: String(v.placeholder ?? ""),
      required: Boolean(v.required),
    };
  });
}

export function serializeCustomerInputBoxes(boxes: CustomerInputBox[]) {
  return boxes
    .filter((b) => b.label.trim() || b.placeholder.trim())
    .map((b) => ({
      label: b.label.trim(),
      placeholder: b.placeholder.trim(),
      required: b.required,
    }));
}

type ProductCustomerInputsProps = {
  boxes: CustomerInputBox[];
  onChange: (boxes: CustomerInputBox[]) => void;
};

export function ProductCustomerInputs({
  boxes,
  onChange,
}: ProductCustomerInputsProps) {
  function update(id: string, patch: Partial<CustomerInputBox>) {
    onChange(boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function remove(id: string) {
    onChange(boxes.filter((b) => b.id !== id));
  }

  function addBox() {
    onChange([...boxes, emptyCustomerInputBox()]);
  }

  return (
    <ProductFormOrderCard
      className="admin-product-form-section"
      icon={
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 9h10M7 13h6" />
        </svg>
      }
      title="Customer input boxes"
      subtitle="Add boxes the customer fills while ordering this product (e.g. game email, password). The answers appear on the order for the admin to see."
    >
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Checkout fields</dt>
        <dd className="admin-product-form-customer-fields space-y-4">
          {boxes.length === 0 ? (
            <p className="text-sm text-subtle">
              No input boxes yet. Add one if you need extra details from the
              customer at checkout.
            </p>
          ) : (
            <div className="space-y-4">
              {boxes.map((box, index) => (
                <div
                  key={box.id}
                  className="admin-product-form-subpanel rounded-xl border border-border bg-sunken p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                      Box {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(box.id)}
                      className="text-xs font-medium text-rose-400 hover:text-rose-300"
                    >
                      🗑 Delete
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        className={labelCls}
                        htmlFor={`cib-label-${box.id}`}
                      >
                        Label (question)
                      </label>
                      <input
                        id={`cib-label-${box.id}`}
                        value={box.label}
                        onChange={(e) =>
                          update(box.id, { label: e.target.value })
                        }
                        placeholder="e.g. Enter your game email ID"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label
                        className={labelCls}
                        htmlFor={`cib-placeholder-${box.id}`}
                      >
                        Placeholder (example text)
                      </label>
                      <input
                        id={`cib-placeholder-${box.id}`}
                        value={box.placeholder}
                        onChange={(e) =>
                          update(box.id, { placeholder: e.target.value })
                        }
                        placeholder="e.g. Example ID: test@gmail.com"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground-muted">
                    <input
                      type="checkbox"
                      checked={box.required}
                      onChange={(e) =>
                        update(box.id, { required: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-border-strong bg-muted/50 text-teal-500 focus:ring-teal-500/40"
                    />
                    Required (customer must fill this box)
                  </label>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={addBox} className="btn-primary">
            + Add input box
          </button>
        </dd>
      </div>
    </ProductFormOrderCard>
  );
}
