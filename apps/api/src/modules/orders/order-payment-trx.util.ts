import { Types, type Model } from 'mongoose';
import type { PaymentIntentDocument } from '../../database/schemas/payment-intent.schema';
import type { SmsLogDocument } from '../../database/schemas/sms-log.schema';

/** Resolves customer-visible payment trx id (MFS submit, SMS match, or gateway ref). */
export async function resolveOrderPaymentTrxId(
  paymentIntentModel: Model<PaymentIntentDocument>,
  smsLogModel: Model<SmsLogDocument>,
  orderId: string,
): Promise<string | undefined> {
  const intent = await paymentIntentModel
    .findOne({ orderId: new Types.ObjectId(orderId) })
    .sort({ createdAt: -1 })
    .select('submittedTrxId gatewayRef')
    .lean()
    .exec();
  if (!intent) {
    return undefined;
  }

  let trxId = intent.submittedTrxId?.trim();

  const matchedSms = await smsLogModel
    .findOne({ matchedPaymentIntentId: intent._id })
    .sort({ createdAt: -1 })
    .select('trxId')
    .lean()
    .exec();

  if (matchedSms?.trxId?.trim()) {
    trxId = matchedSms.trxId.trim();
  } else if (trxId) {
    const smsByTrx = await smsLogModel
      .findOne({ trxId })
      .sort({ createdAt: -1 })
      .select('trxId')
      .lean()
      .exec();
    if (smsByTrx?.trxId?.trim()) {
      trxId = smsByTrx.trxId.trim();
    }
  }

  if (trxId) {
    return trxId;
  }

  return intent.gatewayRef?.trim() || undefined;
}
