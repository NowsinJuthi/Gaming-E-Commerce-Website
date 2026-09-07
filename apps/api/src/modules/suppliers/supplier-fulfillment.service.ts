import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  SupplierCode,
  SupplierOrderStatus,
  SupplierStatus,
  SupplierStockStatus,
} from '../../common/enums';
import {
  SupplierOrder,
  SupplierOrderDocument,
} from '../../database/schemas/supplier-order.schema';
import {
  SupplierProduct,
  SupplierProductDocument,
} from '../../database/schemas/supplier-product.schema';
import { Supplier, SupplierDocument } from '../../database/schemas/supplier.schema';
import { SupplierRegistry } from '../../integrations/suppliers/supplier.registry';
import { SupplierFulfillResult } from '../../integrations/suppliers/supplier-client.interface';

export interface FulfillRequest {
  productId?: string;
  sku?: string;
  quantity: number;
  region?: string;
  orderId?: string;
  amount?: number;
  recipient?: { email?: string; phone?: string };
  idempotencyKey?: string;
}

export interface FulfillOutcome {
  supplierOrderId: string;
  supplierCode: SupplierCode;
  status: SupplierOrderStatus;
  externalOrderId?: string;
  codes: { code: string; serial?: string; pin?: string }[];
  attempt: number;
}

interface Candidate {
  supplierCode: SupplierCode;
  externalProductId: string;
  productId?: Types.ObjectId;
  cost: number;
  currency: string;
  effectivePriority: number;
}

const DEFAULT_PRIORITY = 100;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Routes a fulfillment request across suppliers with automatic failover:
 * candidate offerings are ordered by priority then cost, and each is tried in
 * turn until one delivers. Every attempt is persisted for audit.
 */
@Injectable()
export class SupplierFulfillmentService {
  private readonly logger = new Logger(SupplierFulfillmentService.name);

  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(SupplierProduct.name)
    private readonly offeringModel: Model<SupplierProductDocument>,
    @InjectModel(SupplierOrder.name)
    private readonly supplierOrderModel: Model<SupplierOrderDocument>,
    private readonly registry: SupplierRegistry,
  ) {}

  async fulfill(request: FulfillRequest): Promise<FulfillOutcome> {
    if (request.quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    if (request.idempotencyKey) {
      const prior = await this.supplierOrderModel
        .findOne({
          idempotencyKey: request.idempotencyKey,
          status: SupplierOrderStatus.Success,
        })
        .exec();
      if (prior) {
        return this.toOutcome(prior);
      }
    }

    const candidates = await this.resolveCandidates(request);
    if (candidates.length === 0) {
      throw new ServiceUnavailableException(
        'No active supplier offering available for this product',
      );
    }

    const orderId = request.orderId
      ? new Types.ObjectId(request.orderId)
      : undefined;
    const failures: string[] = [];
    let attempt = 0;

    for (const candidate of candidates) {
      attempt += 1;
      const record = await this.supplierOrderModel.create({
        orderId,
        productId: candidate.productId,
        supplierCode: candidate.supplierCode,
        externalProductId: candidate.externalProductId,
        quantity: request.quantity,
        status: SupplierOrderStatus.Pending,
        attempt,
      });

      try {
        const client = this.registry.get(candidate.supplierCode);
        const result = await client.fulfill({
          externalProductId: candidate.externalProductId,
          quantity: request.quantity,
          reference: String(record._id),
          region: request.region,
          amount: request.amount,
          recipient: request.recipient,
        });

        if (result.status === 'failed') {
          await this.markFailed(
            record,
            candidate.supplierCode,
            result.message ?? 'Supplier reported failure',
          );
          failures.push(`${candidate.supplierCode}: ${record.error}`);
          continue;
        }

        await this.markSettled(record, candidate, result, request);
        return this.toOutcome(record);
      } catch (error) {
        await this.markFailed(
          record,
          candidate.supplierCode,
          errorMessage(error),
        );
        failures.push(`${candidate.supplierCode}: ${record.error}`);
        this.logger.warn(
          `Supplier ${candidate.supplierCode} failed (attempt ${attempt}): ${record.error}`,
        );
      }
    }

    throw new ServiceUnavailableException(
      `All suppliers failed: ${failures.join('; ')}`,
    );
  }

  /** Whether at least one active, in-stock offering exists for a product/SKU. */
  async hasOffering(
    productId?: string,
    sku?: string,
    region?: string,
  ): Promise<boolean> {
    const candidates = await this.resolveCandidates({
      productId,
      sku,
      region,
      quantity: 1,
    });
    return candidates.length > 0;
  }

  // --- Internals ---

  private async resolveCandidates(
    request: FulfillRequest,
  ): Promise<Candidate[]> {
    const filter: FilterQuery<SupplierProductDocument> = {
      enabled: true,
      stockStatus: { $ne: SupplierStockStatus.OutOfStock },
    };
    if (request.productId) {
      filter.productId = new Types.ObjectId(request.productId);
    } else if (request.sku) {
      filter.sku = request.sku;
    } else {
      throw new BadRequestException('productId or sku is required');
    }
    if (request.region) {
      filter.$or = [
        { region: request.region },
        { region: { $exists: false } },
        { region: null },
      ];
    }

    const offerings = await this.offeringModel.find(filter).lean().exec();
    if (offerings.length === 0) {
      return [];
    }

    const codes = [...new Set(offerings.map((o) => o.supplierCode))];
    const suppliers = await this.supplierModel
      .find({ code: { $in: codes } })
      .lean()
      .exec();
    const supplierByCode = new Map(suppliers.map((s) => [s.code, s]));

    const candidates: Candidate[] = [];
    for (const offering of offerings) {
      const supplier = supplierByCode.get(offering.supplierCode);
      if (supplier && supplier.status === SupplierStatus.Disabled) {
        continue;
      }
      if (
        request.region &&
        supplier?.supportedRegions?.length &&
        !supplier.supportedRegions.includes(request.region)
      ) {
        continue;
      }
      candidates.push({
        supplierCode: offering.supplierCode,
        externalProductId: offering.externalProductId,
        productId: offering.productId,
        cost: offering.cost,
        currency: offering.currency,
        effectivePriority:
          offering.priority ?? supplier?.priority ?? DEFAULT_PRIORITY,
      });
    }

    candidates.sort(
      (a, b) =>
        a.effectivePriority - b.effectivePriority || a.cost - b.cost,
    );
    return candidates;
  }

  private async markSettled(
    record: SupplierOrderDocument,
    candidate: Candidate,
    result: SupplierFulfillResult,
    request: FulfillRequest,
  ): Promise<void> {
    record.status =
      result.status === 'success'
        ? SupplierOrderStatus.Success
        : SupplierOrderStatus.Pending;
    record.externalOrderId = result.externalOrderId;
    record.codes = (result.codes ?? []).map((c) => ({
      code: c.code,
      serial: c.serial,
      pin: c.pin,
    }));
    record.cost = result.cost ?? candidate.cost;
    record.currency = result.currency ?? candidate.currency;
    if (request.idempotencyKey) {
      record.idempotencyKey = request.idempotencyKey;
    }
    try {
      await record.save();
    } catch (error) {
      // A concurrent call already claimed the idempotency key; persist without it.
      record.idempotencyKey = undefined;
      await record.save();
      this.logger.warn(
        `Idempotency clash on ${String(record._id)}: ${errorMessage(error)}`,
      );
    }

    await this.supplierModel
      .updateOne(
        { code: candidate.supplierCode },
        { $set: { lastHealthyAt: new Date() }, $unset: { lastError: '' } },
      )
      .exec();
  }

  private async markFailed(
    record: SupplierOrderDocument,
    code: SupplierCode,
    error: string,
  ): Promise<void> {
    record.status = SupplierOrderStatus.Failed;
    record.error = error;
    await record.save();
    await this.supplierModel
      .updateOne({ code }, { $set: { lastError: error } })
      .exec();
  }

  private toOutcome(record: SupplierOrderDocument): FulfillOutcome {
    return {
      supplierOrderId: String(record._id),
      supplierCode: record.supplierCode,
      status: record.status,
      externalOrderId: record.externalOrderId,
      codes: record.codes.map((c) => ({
        code: c.code,
        serial: c.serial,
        pin: c.pin,
      })),
      attempt: record.attempt,
    };
  }
}
