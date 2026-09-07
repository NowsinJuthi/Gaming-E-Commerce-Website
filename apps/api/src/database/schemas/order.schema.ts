import { DEFAULT_CURRENCY } from '@uniqbd/types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  DeliveryType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../common/enums';

@Schema({ _id: false })
export class OrderDeliveredCode {
  @Prop({ required: true })
  code!: string;

  @Prop()
  serial?: string;

  @Prop()
  pin?: string;
}
export const OrderDeliveredCodeSchema =
  SchemaFactory.createForClass(OrderDeliveredCode);

@Schema({ _id: false })
export class OrderItemCustomerInput {
  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  value!: string;
}
export const OrderItemCustomerInputSchema = SchemaFactory.createForClass(
  OrderItemCustomerInput,
);

@Schema({ _id: false })
export class OrderManualGiftCard {
  @Prop({ required: true })
  code!: string;

  @Prop()
  amount?: string;

  @Prop()
  fieldLabel?: string;

  @Prop({ type: Types.ObjectId, ref: 'InventoryItem' })
  inventoryItemId?: Types.ObjectId;
}
export const OrderManualGiftCardSchema =
  SchemaFactory.createForClass(OrderManualGiftCard);

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  slug!: string;

  /** Selected package / variation value id, when the product has variations. */
  @Prop()
  variationValueId?: string;

  /** Buyer-provided values for the product's custom input fields. */
  @Prop({ type: [OrderItemCustomerInputSchema], default: [] })
  customerInputs!: OrderItemCustomerInput[];

  @Prop({ required: true })
  unitPrice!: number;

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  lineTotal!: number;

  @Prop({ type: String, enum: Object.values(DeliveryType), required: true })
  deliveryType!: DeliveryType;

  @Prop({ type: [Types.ObjectId], ref: 'InventoryItem', default: [] })
  inventoryItemIds!: Types.ObjectId[];

  /** Codes handed to the buyer (supplier-procured or unsealed inventory). */
  @Prop({ type: [OrderDeliveredCodeSchema], default: [] })
  deliveredCodes!: OrderDeliveredCode[];

  /** SupplierOrder that fulfilled this line, when sourced from a supplier. */
  @Prop({ type: Types.ObjectId, ref: 'SupplierOrder' })
  supplierOrderId?: Types.ObjectId;

  /** 'inventory' | 'supplier'. */
  @Prop()
  deliverySource?: string;

  @Prop({ default: false })
  delivered!: boolean;
}
export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class OrderPricing {
  @Prop({ required: true })
  subtotal!: number;

  @Prop()
  couponCode?: string;

  @Prop({ default: 0 })
  couponDiscount!: number;

  @Prop()
  voucherCode?: string;

  @Prop({ default: 0 })
  voucherDiscount!: number;

  @Prop({ default: 0 })
  discountTotal!: number;

  @Prop({ required: true })
  total!: number;

  @Prop({ default: DEFAULT_CURRENCY })
  currency!: string;
}
export const OrderPricingSchema = SchemaFactory.createForClass(OrderPricing);

@Schema({ _id: false })
export class OrderPayment {
  @Prop({
    type: String,
    enum: Object.values(PaymentMethod),
    default: PaymentMethod.Wallet,
  })
  method!: PaymentMethod;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.Pending,
  })
  status!: PaymentStatus;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  transactionId?: Types.ObjectId;

  @Prop()
  paidAt?: Date;
}
export const OrderPaymentSchema = SchemaFactory.createForClass(OrderPayment);

@Schema({ _id: false })
export class OrderTimelineEntry {
  @Prop({ type: String, enum: Object.values(OrderStatus), required: true })
  status!: OrderStatus;

  @Prop({ required: true })
  at!: Date;

  @Prop()
  note?: string;
}
export const OrderTimelineEntrySchema =
  SchemaFactory.createForClass(OrderTimelineEntry);

@Schema({ _id: false })
export class OrderContact {
  @Prop({ required: true })
  fullName!: string;

  @Prop({ required: true })
  mobile!: string;

  @Prop({ required: true })
  email!: string;
}
export const OrderContactSchema = SchemaFactory.createForClass(OrderContact);

@Schema({ _id: false })
export class OrderRefund {
  @Prop()
  reason?: string;

  @Prop()
  amount?: number;

  @Prop()
  refundedAt?: Date;
}
export const OrderRefundSchema = SchemaFactory.createForClass(OrderRefund);

/** Idempotent flags for customer status emails (separate from admin Telegram). */
@Schema({ _id: false })
export class OrderCustomerEmails {
  @Prop()
  paidSentAt?: Date;

  /** Order confirmation after payment — not a payment receipt. */
  @Prop()
  confirmationSentAt?: Date;

  @Prop()
  processingSentAt?: Date;

  @Prop()
  deliveredSentAt?: Date;

  @Prop()
  cancelledSentAt?: Date;

  @Prop()
  refundedSentAt?: Date;
}
export const OrderCustomerEmailsSchema =
  SchemaFactory.createForClass(OrderCustomerEmails);

/** Idempotent flags for admin Telegram order alerts (separate from customer email). */
@Schema({ _id: false })
export class OrderAdminTelegram {
  @Prop()
  paidNotifiedAt?: Date;

  @Prop()
  processingNotifiedAt?: Date;

  @Prop()
  fulfilledNotifiedAt?: Date;
}
export const OrderAdminTelegramSchema =
  SchemaFactory.createForClass(OrderAdminTelegram);

@Schema({ _id: false })
export class OrderOrigin {
  @Prop({ default: 'Direct' })
  channel!: string;

  @Prop()
  customerIp?: string;

  @Prop()
  device?: string;

  @Prop()
  browser?: string;

  @Prop()
  operatingSystem?: string;

  @Prop()
  userAgent?: string;
}
export const OrderOriginSchema = SchemaFactory.createForClass(OrderOrigin);

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ required: true, unique: true })
  orderNumber!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], default: [] })
  items!: OrderItem[];

  @Prop({ type: OrderPricingSchema, required: true })
  pricing!: OrderPricing;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.Pending,
    index: true,
  })
  status!: OrderStatus;

  @Prop({ type: OrderPaymentSchema, default: {} })
  payment!: OrderPayment;

  @Prop({ type: [OrderTimelineEntrySchema], default: [] })
  timeline!: OrderTimelineEntry[];

  /** Guards against double coupon/voucher redemption across delivery retries. */
  @Prop({ default: false })
  promotionsRedeemed!: boolean;

  @Prop()
  deliveredAt?: Date;

  /** Message sent to the buyer when the order was marked delivered. */
  @Prop()
  deliveryMessage?: string;

  /** Admin-entered gift cards for manual delivery. */
  @Prop({ type: [OrderManualGiftCardSchema], default: [] })
  manualGiftCards!: OrderManualGiftCard[];

  @Prop({ index: true })
  reservationExpiresAt?: Date;

  @Prop({ type: OrderRefundSchema })
  refund?: OrderRefund;

  @Prop({ type: OrderContactSchema })
  contact?: OrderContact;

  @Prop({ type: OrderOriginSchema })
  origin?: OrderOrigin;

  @Prop({ type: OrderCustomerEmailsSchema, default: {} })
  customerEmails!: OrderCustomerEmails;

  @Prop({ type: OrderAdminTelegramSchema, default: {} })
  adminTelegram!: OrderAdminTelegram;

  createdAt?: Date;
  updatedAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
// Revenue aggregations filter by payment.status + date range — compound index speeds them up.
OrderSchema.index({ 'payment.status': 1, createdAt: -1 });
