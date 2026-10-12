import { Types } from 'mongoose';
import type { PaymentGateway } from '../../common/enums';

export function gatewayRefMatchesIntent(
  intent: { gateway: PaymentGateway } | null | undefined,
  webhookGateway: PaymentGateway,
): boolean {
  return Boolean(intent && intent.gateway === webhookGateway);
}

export function isObjectIdGatewayRef(ref: string): boolean {
  return Types.ObjectId.isValid(ref);
}
