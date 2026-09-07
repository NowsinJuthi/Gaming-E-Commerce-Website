import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  NotificationEvent,
  WalletStatus,
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../../common/enums';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import { round2 } from '../../common/utils/money';
import { Wallet, WalletDocument } from '../../database/schemas/wallet.schema';
import {
  WalletTransaction,
  WalletTransactionDocument,
} from '../../database/schemas/wallet-transaction.schema';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import { WithdrawDto } from './dto/withdraw.dto';

export interface TxnReferenceInput {
  type?: string;
  id?: string | Types.ObjectId;
}

export interface CreditInput {
  userId: string | Types.ObjectId;
  amount: number;
  type: WalletTransactionType;
  reference?: TxnReferenceInput;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  notify?: boolean;
}

export interface DebitInput {
  userId: string | Types.ObjectId;
  amount: number;
  type?: WalletTransactionType;
  reference?: TxnReferenceInput;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  notify?: boolean;
}

const CREDIT_TYPES: ReadonlySet<WalletTransactionType> = new Set([
  WalletTransactionType.Deposit,
  WalletTransactionType.Cashback,
  WalletTransactionType.ReferralBonus,
  WalletTransactionType.AffiliateCommission,
  WalletTransactionType.Refund,
  WalletTransactionType.Adjustment,
]);

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: number }).code === 11000;

function isTransactionUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /replica set|mongos|Transaction numbers are only allowed/i.test(
    message,
  );
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(WalletTransaction.name)
    private readonly txnModel: Model<WalletTransactionDocument>,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  // --- Reads ---

  async getWallet(userId: string): Promise<WalletDocument> {
    return this.ensureWallet(userId);
  }

  async listTransactions(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<WalletTransactionDocument>> {
    const filter = { userId: new Types.ObjectId(userId) };
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.txnModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.txnModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }

  // --- Credit helpers (used internally and by other modules) ---

  deposit(
    input: Omit<CreditInput, 'type'>,
  ): Promise<WalletTransactionDocument> {
    return this.credit({ ...input, type: WalletTransactionType.Deposit });
  }

  cashback(
    input: Omit<CreditInput, 'type'>,
  ): Promise<WalletTransactionDocument> {
    return this.credit({ ...input, type: WalletTransactionType.Cashback });
  }

  referralBonus(
    input: Omit<CreditInput, 'type'>,
  ): Promise<WalletTransactionDocument> {
    return this.credit({
      ...input,
      type: WalletTransactionType.ReferralBonus,
    });
  }

  affiliateCommission(
    input: Omit<CreditInput, 'type'>,
  ): Promise<WalletTransactionDocument> {
    return this.credit({
      ...input,
      type: WalletTransactionType.AffiliateCommission,
    });
  }

  refund(input: Omit<CreditInput, 'type'>): Promise<WalletTransactionDocument> {
    return this.credit({ ...input, type: WalletTransactionType.Refund });
  }

  /** Admin-driven manual credit; rejects debit types. */
  adminCredit(input: CreditInput): Promise<WalletTransactionDocument> {
    if (!CREDIT_TYPES.has(input.type)) {
      throw new BadRequestException(
        `${input.type} is not a manual credit type`,
      );
    }
    return this.credit(input);
  }

  /**
   * Atomically increments the wallet and writes a ledger entry in a single
   * MongoDB transaction. Idempotent when `idempotencyKey` is supplied.
   */
  async credit(input: CreditInput): Promise<WalletTransactionDocument> {
    const amount = round2(input.amount);
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (input.idempotencyKey) {
      const existing = await this.txnModel
        .findOne({ idempotencyKey: input.idempotencyKey })
        .exec();
      if (existing) {
        return existing;
      }
    }

    const userId = new Types.ObjectId(input.userId);
    const session = await this.connection.startSession();
    try {
      let txn: WalletTransactionDocument | undefined;
      await session.withTransaction(async () => {
        const wallet = await this.walletModel.findOneAndUpdate(
          { userId },
          {
            $inc: { balance: amount, totalCredited: amount },
            $setOnInsert: {
              currency: 'BDT',
              status: WalletStatus.Active,
              pendingBalance: 0,
              totalDebited: 0,
            },
          },
          { new: true, upsert: true, session },
        );
        if (!wallet) {
          throw new Error('Wallet upsert failed');
        }
        const balanceAfter = round2(wallet.balance);
        const created = await this.txnModel.create(
          [
            {
              userId,
              type: input.type,
              direction: WalletTransactionDirection.Credit,
              status: WalletTransactionStatus.Completed,
              amount,
              currency: wallet.currency,
              balanceBefore: round2(balanceAfter - amount),
              balanceAfter,
              reference: this.toReference(input.reference),
              idempotencyKey: input.idempotencyKey,
              description: input.description,
              metadata: input.metadata,
            },
          ],
          { session },
        );
        txn = created[0];
      });

      if (!txn) {
        throw new Error('Credit transaction not created');
      }
      if (input.notify !== false) {
        await this.notify(
          userId,
          'Wallet credited',
          `${amount} ${txn.currency} was added to your wallet.`,
          txn,
          NotificationEvent.WalletCredited,
        );
      }
      return txn;
    } catch (error) {
      if (input.idempotencyKey && isDuplicateKeyError(error)) {
        const existing = await this.txnModel
          .findOne({ idempotencyKey: input.idempotencyKey })
          .exec();
        if (existing) {
          return existing;
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Atomically debits the wallet with overdraft protection (the conditional
   * `balance >= amount` filter guarantees no negative balance under
   * concurrency) and writes a completed debit ledger entry. Defaults to a
   * Purchase, used by wholesale/reseller checkout. Idempotent via key.
   */
  async debit(input: DebitInput): Promise<WalletTransactionDocument> {
    const amount = round2(input.amount);
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (input.idempotencyKey) {
      const existing = await this.txnModel
        .findOne({ idempotencyKey: input.idempotencyKey })
        .exec();
      if (existing) {
        return existing;
      }
    }

    const type = input.type ?? WalletTransactionType.Purchase;
    const userId = new Types.ObjectId(input.userId);
    await this.ensureWallet(input.userId.toString());

    try {
      const txn = await this.debitWithOptionalTransaction(input, userId, amount, type);
      if (input.notify !== false) {
        try {
          await this.notify(
            userId,
            'Wallet debited',
            `${amount} ${txn.currency} was deducted from your wallet.`,
            txn,
            NotificationEvent.WalletDebited,
          );
        } catch (notifyError) {
          this.logger.warn(
            `Wallet debit notification failed for user ${userId.toString()}`,
            notifyError instanceof Error ? notifyError.message : String(notifyError),
          );
        }
      }
      return txn;
    } catch (error) {
      if (input.idempotencyKey && isDuplicateKeyError(error)) {
        const existing = await this.txnModel
          .findOne({ idempotencyKey: input.idempotencyKey })
          .exec();
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  private async debitWithOptionalTransaction(
    input: DebitInput,
    userId: Types.ObjectId,
    amount: number,
    type: WalletTransactionType,
  ): Promise<WalletTransactionDocument> {
    const session = await this.connection.startSession();
    try {
      let txn: WalletTransactionDocument | undefined;
      await session.withTransaction(async () => {
        txn = await this.createDebitLedgerEntry(
          userId,
          amount,
          type,
          input,
          session,
        );
      });
      if (!txn) {
        throw new Error('Debit transaction not created');
      }
      return txn;
    } catch (error) {
      if (!isTransactionUnsupported(error)) {
        throw error;
      }
      this.logger.warn(
        'MongoDB transactions unavailable — debiting wallet without a session',
      );
      const txn = await this.createDebitLedgerEntry(
        userId,
        amount,
        type,
        input,
      );
      if (!txn) {
        throw new Error('Debit transaction not created');
      }
      return txn;
    } finally {
      await session.endSession();
    }
  }

  private async createDebitLedgerEntry(
    userId: Types.ObjectId,
    amount: number,
    type: WalletTransactionType,
    input: Pick<
      DebitInput,
      'reference' | 'idempotencyKey' | 'description' | 'metadata'
    >,
    session?: import('mongoose').ClientSession,
  ): Promise<WalletTransactionDocument> {
    const wallet = await this.walletModel.findOneAndUpdate(
      {
        userId,
        status: WalletStatus.Active,
        balance: { $gte: amount },
      },
      { $inc: { balance: -amount, totalDebited: amount } },
      { new: true, session: session ?? undefined },
    );
    if (!wallet) {
      throw new BadRequestException(
        'Insufficient balance or wallet is not active',
      );
    }
    const balanceAfter = round2(wallet.balance);
    const created = await this.txnModel.create(
      [
        {
          userId,
          type,
          direction: WalletTransactionDirection.Debit,
          status: WalletTransactionStatus.Completed,
          amount,
          currency: wallet.currency,
          balanceBefore: round2(balanceAfter + amount),
          balanceAfter,
          reference: this.toReference(input.reference),
          idempotencyKey: input.idempotencyKey,
          description: input.description,
          metadata: input.metadata,
        },
      ],
      session ? { session } : undefined,
    );
    return created[0]!;
  }

  // --- Withdrawal flow ---

  /**
   * Reserves funds for withdrawal: moves `amount` from `balance` to
   * `pendingBalance` and records a pending debit. The conditional update
   * guarantees no overdraft even under concurrency.
   */
  async requestWithdrawal(
    userId: string,
    dto: WithdrawDto,
  ): Promise<WalletTransactionDocument> {
    const amount = round2(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    await this.ensureWallet(userId);

    const ownerId = new Types.ObjectId(userId);
    const session = await this.connection.startSession();
    try {
      let txn: WalletTransactionDocument | undefined;
      await session.withTransaction(async () => {
        const wallet = await this.walletModel.findOneAndUpdate(
          {
            userId: ownerId,
            status: WalletStatus.Active,
            balance: { $gte: amount },
          },
          { $inc: { balance: -amount, pendingBalance: amount } },
          { new: true, session },
        );
        if (!wallet) {
          throw new BadRequestException(
            'Insufficient balance or wallet is not active',
          );
        }
        const balanceAfter = round2(wallet.balance);
        const created = await this.txnModel.create(
          [
            {
              userId: ownerId,
              type: WalletTransactionType.Withdrawal,
              direction: WalletTransactionDirection.Debit,
              status: WalletTransactionStatus.Pending,
              amount,
              currency: wallet.currency,
              balanceBefore: round2(balanceAfter + amount),
              balanceAfter,
              description: dto.note,
              metadata: {
                method: dto.method,
                accountNumber: dto.accountNumber,
              },
            },
          ],
          { session },
        );
        txn = created[0];
      });

      if (!txn) {
        throw new Error('Withdrawal transaction not created');
      }
      await this.notify(
        ownerId,
        'Withdrawal requested',
        `Your withdrawal of ${amount} ${txn.currency} is being processed.`,
        txn,
      );
      return txn;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Settles a pending withdrawal. On approval the held amount leaves
   * `pendingBalance`; on rejection it is returned to `balance`.
   */
  async processWithdrawal(
    transactionId: string,
    approve: boolean,
    note?: string,
  ): Promise<WalletTransactionDocument> {
    const txn = await this.txnModel.findById(transactionId).exec();
    if (!txn || txn.type !== WalletTransactionType.Withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }
    if (txn.status !== WalletTransactionStatus.Pending) {
      throw new BadRequestException('Withdrawal already processed');
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        if (approve) {
          await this.walletModel
            .updateOne(
              { userId: txn.userId },
              {
                $inc: {
                  pendingBalance: -txn.amount,
                  totalDebited: txn.amount,
                },
              },
              { session },
            )
            .exec();
          txn.status = WalletTransactionStatus.Completed;
        } else {
          await this.walletModel
            .updateOne(
              { userId: txn.userId },
              { $inc: { pendingBalance: -txn.amount, balance: txn.amount } },
              { session },
            )
            .exec();
          txn.status = WalletTransactionStatus.Reversed;
        }
        if (note) {
          txn.description = note;
        }
        await txn.save({ session });
      });
    } finally {
      await session.endSession();
    }

    await this.notify(
      txn.userId,
      approve ? 'Withdrawal completed' : 'Withdrawal rejected',
      approve
        ? `Your withdrawal of ${txn.amount} ${txn.currency} has been paid out.`
        : `Your withdrawal of ${txn.amount} ${txn.currency} was rejected and refunded.`,
      txn,
      NotificationEvent.WithdrawalProcessed,
    );
    return txn;
  }

  // --- Internals ---

  private async ensureWallet(userId: string): Promise<WalletDocument> {
    const ownerId = new Types.ObjectId(userId);
    const wallet = await this.walletModel
      .findOneAndUpdate(
        { userId: ownerId },
        {
          $setOnInsert: {
            userId: ownerId,
            balance: 0,
            pendingBalance: 0,
            currency: 'BDT',
            status: WalletStatus.Active,
            totalCredited: 0,
            totalDebited: 0,
          },
        },
        { new: true, upsert: true },
      )
      .exec();
    if (!wallet) {
      throw new Error('Wallet could not be created');
    }
    return wallet;
  }

  private toReference(
    ref?: TxnReferenceInput,
  ): { type?: string; id?: Types.ObjectId } | undefined {
    if (!ref) {
      return undefined;
    }
    return {
      type: ref.type,
      id: ref.id ? new Types.ObjectId(ref.id) : undefined,
    };
  }

  private async notify(
    userId: Types.ObjectId,
    title: string,
    body: string,
    txn: WalletTransactionDocument,
    event?: NotificationEvent,
  ): Promise<void> {
    if (event === NotificationEvent.WalletCredited) {
      await this.dispatcher.dispatch(event, userId, {
        amount: txn.amount,
        currency: txn.currency,
      });
      return;
    }
    if (event === NotificationEvent.WalletDebited) {
      await this.dispatcher.dispatch(event, userId, {
        amount: txn.amount,
        currency: txn.currency,
      });
      return;
    }
    if (event === NotificationEvent.WithdrawalProcessed) {
      await this.dispatcher.dispatch(event, userId, {
        amount: txn.amount,
        currency: txn.currency,
        status: title.toLowerCase().includes('reject') ? 'rejected' : 'completed',
      });
      return;
    }
    await this.dispatcher.dispatch(NotificationEvent.Custom, userId, {
      title,
      body,
      transactionId: String(txn._id),
      type: txn.type,
      amount: txn.amount,
    });
  }
}
