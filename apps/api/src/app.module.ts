import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HealthModule } from './modules/health/health.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CryptoModule } from './shared/crypto/crypto.module';
import { RedisModule } from './shared/cache/redis.module';
import { QueuesModule } from './queues/queues.module';
import { AuditModule } from './shared/audit/audit.module';
import { SecurityModule } from './security/security.module';
import { MailModule } from './integrations/mail/mail.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { KycModule } from './modules/kyc/kyc.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { BlogModule } from './modules/blog/blog.module';
import { ProductsModule } from './modules/products/products.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SearchModule } from './modules/search/search.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MfsModule } from './modules/mfs/mfs.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { ChatModule } from './modules/chat/chat.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AffiliateModule } from './modules/affiliate/affiliate.module';
import { ResellerModule } from './modules/reseller/reseller.module';
import { AdminModule } from './modules/admin/admin.module';
import { CustomerPanelModule } from './modules/customer-panel/customer-panel.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { RolePermissionsModule } from './modules/role-permissions/role-permissions.module';
import { SeoModule } from './modules/seo/seo.module';
import { ContactModule } from './modules/contact/contact.module';
import { WebsiteModule } from './modules/website/website.module';
import { ContactInquiriesModule } from './modules/contact-inquiries/contact-inquiries.module';
import { ProductRequestsModule } from './modules/product-requests/product-requests.module';
import { EventsModule } from './shared/events/events.module';
import { LicenseModule } from './modules/license/license.module';

/**
 * Root application module.
 * Wired: Config, Database, Crypto, Redis, Queues, Audit, Mail, Users, Auth,
 * Notifications, KYC, Categories, Brands, Products, Search, Coupons,
 * Vouchers, Cart, Orders, Wallet, Payments, Suppliers, Delivery, Chat, Tickets.
 * A global JWT guard protects all routes by default (opt out with @Public()).
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Never log secrets/credentials that arrive in headers.
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'req.headers["x-recaptcha-token"]',
        ],
        // Skip noisy health-probe access logs.
        autoLogging: {
          ignore: (req) => (req.url ?? '').includes('/health'),
        },
      },
    }),
    DatabaseModule,
    HealthModule,
    CryptoModule,
    RedisModule,
    QueuesModule,
    AuditModule,
    SecurityModule,
    MailModule,
    UsersModule,
    AuthModule,
    NotificationsModule,
    KycModule,
    CategoriesModule,
    BrandsModule,
    BlogModule,
    ProductsModule,
    ReviewsModule,
    SearchModule,
    CouponsModule,
    VouchersModule,
    CartModule,
    WalletModule,
    OrdersModule,
    PaymentsModule,
    MfsModule,
    SuppliersModule,
    DeliveryModule,
    ChatModule,
    TicketsModule,
    AffiliateModule,
    ResellerModule,
    AdminModule,
    CustomerPanelModule,
    WishlistModule,
    RewardsModule,
    RolePermissionsModule,
    SeoModule,
    ContactModule,
    WebsiteModule,
    ContactInquiriesModule,
    ProductRequestsModule,
    EventsModule,
    LicenseModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
