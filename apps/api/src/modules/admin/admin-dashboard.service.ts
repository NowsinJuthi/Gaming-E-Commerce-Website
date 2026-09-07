import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  OrderStatus,
  PaymentStatus,
  SupplierOrderStatus,
} from '../../common/enums';
import { round2 } from '../../common/utils/money';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import {
  SupplierOrder,
  SupplierOrderDocument,
} from '../../database/schemas/supplier-order.schema';
import {
  Supplier,
  SupplierDocument,
} from '../../database/schemas/supplier.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { Wallet, WalletDocument } from '../../database/schemas/wallet.schema';
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';
import { EventsService } from '../../shared/events/events.service';
import { AppEvent } from '../../shared/events/events.types';
import { DateRangeDto } from './dto/date-range.dto';

interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(SupplierOrder.name)
    private readonly supplierOrderModel: Model<SupplierOrderDocument>,
    private readonly cache: CacheService,
    private readonly events: EventsService,
  ) {}

  /** Combined snapshot for the landing view of the dashboard. Cached for 30s. */
  async overview() {
    const cached = await this.cache.getJson<ReturnType<typeof this.buildOverview>>(
      CacheKeys.admin.dashboardOverview,
    );
    if (cached) return cached;

    const result = await this.buildOverview();
    await this.cache.setJson(
      CacheKeys.admin.dashboardOverview,
      result,
      CacheKeys.ttl.adminDashboard,
    );
    return result;
  }

  /** Invalidate the overview cache (call after writes that affect dashboard stats). */
  async invalidateOverviewCache(): Promise<void> {
    await Promise.all([
      this.cache.del(CacheKeys.admin.dashboardOverview),
      this.cache.delByPrefix(CacheKeys.admin.dashboardReportsPrefix),
    ]);
  }

  private async buildOverview() {
    const [revenue, orders, users, suppliers, wallet] = await Promise.all([
      this.revenue(),
      this.orders(),
      this.users(),
      this.suppliers(),
      this.wallet(),
    ]);
    return { revenue, orders, users, suppliers, wallet };
  }

  async wallet() {
    const [walletAgg, withBalance] = await Promise.all([
      this.walletModel
        .aggregate<{ total: number }>([
          { $group: { _id: null, total: { $sum: '$balance' } } },
        ])
        .exec(),
      this.walletModel.countDocuments({ balance: { $gt: 0 } }).exec(),
    ]);

    return {
      currency: 'BDT',
      total: round2(walletAgg[0]?.total ?? 0),
      withBalance,
    };
  }

  // --- Revenue ---

  async revenue() {
    const [total, today, last7Days, last30Days, refunded] = await Promise.all([
      this.sumPaid({}),
      this.sumPaid({ createdAt: { $gte: this.dayStart() } }),
      this.sumPaid({ createdAt: { $gte: this.daysAgo(7) } }),
      this.sumPaid({ createdAt: { $gte: this.daysAgo(30) } }),
      this.sumRefunded(),
    ]);
    return {
      currency: 'BDT',
      total,
      today,
      last7Days,
      last30Days,
      refunded,
      net: round2(total - refunded),
    };
  }

  // --- Orders ---

  async orders() {
    const [byStatus, total, today, paidAgg] = await Promise.all([
      this.orderModel.aggregate<{ _id: OrderStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.orderModel.countDocuments().exec(),
      this.orderModel
        .countDocuments({ createdAt: { $gte: this.dayStart() } })
        .exec(),
      this.orderModel.aggregate<{ count: number; total: number }>([
        { $match: { 'payment.status': PaymentStatus.Paid } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$pricing.total' } } },
      ]),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row._id] = row.count;
    }
    const paidCount = paidAgg[0]?.count ?? 0;
    const paidTotal = paidAgg[0]?.total ?? 0;

    return {
      total,
      today,
      byStatus: statusCounts,
      pending: statusCounts[OrderStatus.Pending] ?? 0,
      delivered: statusCounts[OrderStatus.Delivered] ?? 0,
      refunded: statusCounts[OrderStatus.Refunded] ?? 0,
      averageOrderValue: paidCount > 0 ? round2(paidTotal / paidCount) : 0,
      recent: await this.recentOrders(),
    };
  }

  private async recentOrders() {
    const orders = await this.orderModel
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderNumber status pricing.total pricing.currency payment.status createdAt')
      .lean()
      .exec();
    return orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.pricing?.total ?? 0,
      currency: o.pricing?.currency ?? 'BDT',
      paymentStatus: o.payment?.status,
      createdAt: o.createdAt,
    }));
  }

  // --- Users ---

  async users() {
    const [total, today, last7Days, last30Days, byRole, byStatus] =
      await Promise.all([
        this.userModel.countDocuments().exec(),
        this.userModel
          .countDocuments({ createdAt: { $gte: this.dayStart() } })
          .exec(),
        this.userModel
          .countDocuments({ createdAt: { $gte: this.daysAgo(7) } })
          .exec(),
        this.userModel
          .countDocuments({ createdAt: { $gte: this.daysAgo(30) } })
          .exec(),
        this.userModel.aggregate<{ _id: string; count: number }>([
          { $unwind: '$roles' },
          { $group: { _id: '$roles', count: { $sum: 1 } } },
        ]),
        this.userModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
      ]);

    const recent = await this.userModel
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('email profile.displayName roles status emailVerified createdAt')
      .lean()
      .exec();

    return {
      total,
      newToday: today,
      newLast7Days: last7Days,
      newLast30Days: last30Days,
      byRole: this.toCountMap(byRole),
      byStatus: this.toCountMap(byStatus),
      recent: recent.map((u) => ({
        id: String(u._id),
        email: u.email,
        displayName: u.profile?.displayName,
        roles: u.roles,
        status: u.status,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
      })),
    };
  }

  // --- Suppliers ---

  async suppliers() {
    const [suppliers, procurement] = await Promise.all([
      this.supplierModel.find().sort({ priority: 1 }).lean().exec(),
      this.supplierOrderModel.aggregate<{ _id: SupplierOrderStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const counts = this.toCountMap(procurement);
    const success = counts[SupplierOrderStatus.Success] ?? 0;
    const failed = counts[SupplierOrderStatus.Failed] ?? 0;
    const pending = counts[SupplierOrderStatus.Pending] ?? 0;
    const attempts = success + failed;

    return {
      list: suppliers.map((s) => ({
        code: s.code,
        name: s.name,
        status: s.status,
        priority: s.priority,
        balance: s.lastBalance,
        balanceCurrency: s.lastBalanceCurrency,
        lastHealthyAt: s.lastHealthyAt,
        lastError: s.lastError,
      })),
      procurement: {
        success,
        failed,
        pending,
        successRate: attempts > 0 ? round2((success / attempts) * 100) : 0,
      },
    };
  }

  // --- Reports (range-based) ---

  async reports(query: DateRangeDto) {
    const range = this.resolveRange(query);
    const fromKey = range.from.toISOString().slice(0, 10);
    const toKey = range.to.toISOString().slice(0, 10);
    const cacheKey = CacheKeys.admin.dashboardReports(fromKey, toKey);

    const cached = await this.cache.getJson<Awaited<ReturnType<typeof this.buildReports>>>(
      cacheKey,
    );
    if (cached) return cached;

    const result = await this.buildReports(range);
    await this.cache.setJson(
      cacheKey,
      result,
      CacheKeys.ttl.adminDashboardReports,
    );
    return result;
  }

  private async buildReports(range: DateRange) {
    const [timeseries, topProducts, paymentBreakdown, productSell] =
      await Promise.all([
        this.dailyRevenue(range),
        this.topProducts(range),
        this.paymentBreakdown(range),
        this.productSellSummary(range),
      ]);
    return {
      range: { from: range.from, to: range.to },
      timeseries,
      topProducts,
      paymentBreakdown,
      productSell,
    };
  }

  private async productSellSummary(range: DateRange) {
    const rows = await this.orderModel.aggregate<{
      itemsSold: number;
      netSales: number;
      productsSold: number;
    }>([
      {
        $match: {
          'payment.status': PaymentStatus.Paid,
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          itemsSold: { $sum: '$items.quantity' },
          netSales: { $sum: '$items.lineTotal' },
          productIds: { $addToSet: '$items.productId' },
        },
      },
      {
        $project: {
          _id: 0,
          itemsSold: 1,
          netSales: 1,
          productsSold: { $size: '$productIds' },
        },
      },
    ]);
    const row = rows[0];
    return {
      netSales: round2(row?.netSales ?? 0),
      itemsSold: row?.itemsSold ?? 0,
      productsSold: row?.productsSold ?? 0,
    };
  }

  private async dailyRevenue(range: DateRange) {
    const rows = await this.orderModel.aggregate<{
      _id: string;
      revenue: number;
      orders: number;
    }>([
      {
        $match: {
          'payment.status': PaymentStatus.Paid,
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$pricing.total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({
      date: r._id,
      revenue: round2(r.revenue),
      orders: r.orders,
    }));
  }

  private async topProducts(range: DateRange) {
    const rows = await this.orderModel.aggregate<{
      _id: unknown;
      title: string;
      quantity: number;
      revenue: number;
    }>([
      {
        $match: {
          'payment.status': PaymentStatus.Paid,
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          title: { $first: '$items.title' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);
    return rows.map((r) => ({
      productId: String(r._id),
      title: r.title,
      quantity: r.quantity,
      revenue: round2(r.revenue),
    }));
  }

  private async paymentBreakdown(range: DateRange) {
    const rows = await this.orderModel.aggregate<{
      _id: string;
      count: number;
      total: number;
    }>([
      {
        $match: {
          'payment.status': PaymentStatus.Paid,
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: '$payment.method',
          count: { $sum: 1 },
          total: { $sum: '$pricing.total' },
        },
      },
    ]);
    return rows.map((r) => ({
      method: r._id,
      count: r.count,
      total: round2(r.total),
    }));
  }

  // --- Internals ---

  private async sumPaid(match: FilterQuery<OrderDocument>): Promise<number> {
    const res = await this.orderModel.aggregate<{ total: number }>([
      { $match: { 'payment.status': PaymentStatus.Paid, ...match } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } },
    ]);
    return round2(res[0]?.total ?? 0);
  }

  private async sumRefunded(): Promise<number> {
    const res = await this.orderModel.aggregate<{ total: number }>([
      { $match: { status: OrderStatus.Refunded } },
      { $group: { _id: null, total: { $sum: '$refund.amount' } } },
    ]);
    return round2(res[0]?.total ?? 0);
  }

  private toCountMap(
    rows: { _id: string; count: number }[],
  ): Record<string, number> {
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row._id] = row.count;
    }
    return map;
  }

  private resolveRange(query: DateRangeDto): DateRange {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : this.daysAgo(30);
    return { from, to };
  }

  private dayStart(date = new Date()): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  // ── Publish ────────────────────────────────────────────────────────────────

  /**
   * Clears all public-facing Redis caches, persists a publish timestamp, and
   * broadcasts site.published to every connected Socket.IO client so that
   * frontends invalidate their React Query caches immediately.
   */
  async publish(): Promise<{ at: string }> {
    await Promise.all([
      this.cache.delByPrefix(CacheKeys.publish.productDetailPrefix),
      this.cache.delByPrefix(CacheKeys.product.listPrefix),
      this.cache.delByPrefix(CacheKeys.product.homepageSectionsPrefix),
      this.cache.del(CacheKeys.settings.panel),
      this.cache.del(CacheKeys.settings.seo),
      this.cache.del(CacheKeys.admin.dashboardOverview),
      this.cache.delByPrefix(CacheKeys.admin.dashboardReportsPrefix),
    ]);

    const at = new Date().toISOString();
    // Persist with a long TTL (90 days) so the timestamp survives Redis restarts.
    await this.cache.set(CacheKeys.publish.lastPublish, at, 60 * 60 * 24 * 90);

    this.events.emit(AppEvent.SitePublished, { at });

    return { at };
  }

  /** Returns the ISO timestamp of the most recent publish, or null. */
  async getLastPublish(): Promise<{ at: string | null }> {
    const at = await this.cache.get(CacheKeys.publish.lastPublish);
    return { at };
  }
}
