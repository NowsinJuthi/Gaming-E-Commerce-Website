export interface CartCustomerInput {
  label: string;
  value: string;
}

export interface StoredCartItem {
  productId: string;
  quantity: number;
  /** Selected package / variation value id from the product page. */
  variationValueId?: string;
  /** Buyer-provided values for the product's custom input fields. */
  customerInputs?: CartCustomerInput[];
}

export interface StoredCart {
  items: StoredCartItem[];
  couponCode?: string;
  voucherCode?: string;
  updatedAt: string;
}

export interface CartLineItem {
  productId: string;
  title: string;
  slug: string;
  packageName?: string;
  variationValueId?: string;
  customerInputs?: CartCustomerInput[];
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  thumbnail?: string;
  availableStock: number;
}

export interface CartCouponView {
  code: string;
  discount: number;
  valid: boolean;
  reason?: string;
}

export interface CartVoucherView {
  code: string;
  amount: number;
  applied: number;
  valid: boolean;
  reason?: string;
}

export interface CartView {
  items: CartLineItem[];
  subtotal: number;
  coupon: CartCouponView | null;
  voucher: CartVoucherView | null;
  discountTotal: number;
  total: number;
  currency: string;
}
