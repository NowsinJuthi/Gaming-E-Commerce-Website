import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, TokenType, UserStatus } from '../../common/enums';
import {
  AuthSession,
  AuthSessionDocument,
} from '../../database/schemas/auth-session.schema';
import {
  VerificationToken,
  VerificationTokenDocument,
} from '../../database/schemas/verification-token.schema';
import { UserDocument } from '../../database/schemas/user.schema';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { MailService } from '../../integrations/mail/mail.service';
import { accessTokenVersionMatches } from './access-token-version';
import { enumerationSafeRegisterResult } from './auth-register';
import { UsersService } from '../users/users.service';
import { CustomerPanelSettingsService } from '../customer-panel/customer-panel-settings.service';
import {
  AuthResult,
  AuthTokens,
  AuthenticatedUser,
  JwtPayload,
  PublicUser,
  RegisterResult,
  OtpRequestResult,
  PasswordResetRequestResult,
  PasswordResetConfirmResult,
  SessionMeta,
} from './auth.types';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestOtpDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyOtpDto,
} from './dto';
import { EmailDomainPolicyService } from '../../security/email-domain-policy.service';
import {
  AUTH_INVALID_CREDENTIALS_MESSAGE,
  AUTH_OTP_REQUEST_MESSAGE,
} from './auth.constants';
import { LONG_SESSION_TTL_SECONDS } from '../../config/session-ttl';
import { isEphemeralGuestUser } from '../../common/utils/guest-user';

const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000; // 10 minutes for 6-digit code
const OTP_TTL_MS = 5 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 2 * 60 * 1000; // must wait 2 minutes before resending
const MAX_OTP_ATTEMPTS = 5;
const PASSWORD_RESET_REQUEST_MESSAGE =
  'If an account exists for this email, a password reset code has been sent.';
const PASSWORD_RESET_CONFIRM_MESSAGE =
  'Your password has been reset. You can log in with your new password.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly panelSettings: CustomerPanelSettingsService,
    private readonly crypto: CryptoService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectModel(AuthSession.name)
    private readonly sessionModel: Model<AuthSessionDocument>,
    @InjectModel(VerificationToken.name)
    private readonly tokenModel: Model<VerificationTokenDocument>,
    private readonly emailDomainPolicy: EmailDomainPolicyService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    await this.emailDomainPolicy.assertRegistrationAllowed(dto.email);
    const [existing, readiness, passwordHash] = await Promise.all([
      this.users.findByEmail(dto.email),
      this.mail.getAuthEmailReadiness(),
      this.crypto.hashPassword(dto.password),
    ]);
    if (!readiness.ready) {
      throw new ServiceUnavailableException(
        readiness.message ??
          'Email service is temporarily unavailable. Please try again later.',
      );
    }
    if (existing) {
      return enumerationSafeRegisterResult(existing.email);
    }

    const user = await this.users.create({ email: dto.email, passwordHash });

    void this.issueAndSendAuthCode({
      userId: user._id,
      email: user.email,
      type: TokenType.EmailVerification,
    }).catch((err) => {
      this.logger.error(
        `Verification email failed for ${user.email}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });

    return { requiresVerification: true, email: user.email };
  }

  async login(
    dto: LoginDto,
    meta: SessionMeta,
    opts?: { accessTtlOverride?: number; refreshTtlOverride?: number },
  ): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email, true);
    if (!user) {
      // Perform a password hash verification to reduce timing-based account
      // enumeration without storing or exposing a real user's hash.
      await this.crypto.verifyPassword(
        dto.password,
        '00000000000000000000000000000000:' +
          '00'.repeat(64),
      );
      throw new UnauthorizedException(AUTH_INVALID_CREDENTIALS_MESSAGE);
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException(AUTH_INVALID_CREDENTIALS_MESSAGE);
    }
    const valid = await this.crypto.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!valid) {
      throw new UnauthorizedException(AUTH_INVALID_CREDENTIALS_MESSAGE);
    }
    if (
      user.status === UserStatus.Banned ||
      user.status === UserStatus.Suspended
    ) {
      throw new UnauthorizedException(AUTH_INVALID_CREDENTIALS_MESSAGE);
    }
    const tokens = await this.issueTokens(user, meta, opts);
    return { user: this.toPublic(user), ...tokens };
  }

  private static readonly REFRESH_REUSE_RACE_WINDOW_MS = 60_000;

  async refresh(
    dto: RefreshTokenDto,
    meta: SessionMeta,
    opts?: { accessTtlOverride?: number; refreshTtlOverride?: number },
  ): Promise<AuthTokens> {
    if (!dto.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    const tokenHash = this.crypto.hashToken(dto.refreshToken);
    const session = await this.sessionModel.findOne({ tokenHash }).exec();

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.revoked) {
      await this.handleRefreshTokenReuse(session);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (
      user.status === UserStatus.Banned ||
      user.status === UserStatus.Suspended
    ) {
      session.revoked = true;
      await session.save();
      throw new UnauthorizedException('Account is not active');
    }

    // Claim the token atomically. Concurrent refreshes cannot both mint a new
    // session from the same token.
    const claimed = await this.sessionModel
      .findOneAndUpdate(
        { _id: session._id, revoked: false },
        { $set: { revoked: true } },
        { new: true },
      )
      .exec();
    if (!claimed) {
      const raced = await this.sessionModel.findById(session._id).exec();
      if (raced) await this.handleRefreshTokenReuse(raced);
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueTokens(user, meta, opts);
  }

  private async handleRefreshTokenReuse(
    session: AuthSessionDocument,
  ): Promise<void> {
    const rotatedAt = session.updatedAt?.getTime() ?? 0;
    const likelyTabRace =
      rotatedAt > 0 &&
      Date.now() - rotatedAt <= AuthService.REFRESH_REUSE_RACE_WINDOW_MS;
    if (likelyTabRace) return;

    const recentReplacement = await this.sessionModel
      .countDocuments({
        userId: session.userId,
        revoked: false,
        createdAt: { $gte: new Date(Date.now() - 120_000) },
      })
      .exec();
    if (recentReplacement > 0) return;

    await this.sessionModel
      .updateMany(
        { userId: session.userId, revoked: false },
        { $set: { revoked: true } },
      )
      .exec();
    this.logger.warn(
      'Refresh-token reuse detected; active sessions were revoked',
    );
  }

  async logout(dto: RefreshTokenDto): Promise<{ success: boolean }> {
    if (!dto.refreshToken) {
      return { success: true };
    }
    const tokenHash = this.crypto.hashToken(dto.refreshToken);
    await this.sessionModel
      .updateOne({ tokenHash }, { $set: { revoked: true } })
      .exec();
    return { success: true };
  }

  async protectBrowserSession(refreshToken: string): Promise<string> {
    const csrfToken = this.crypto.generateToken(24);
    const result = await this.sessionModel
      .updateOne(
        {
          tokenHash: this.crypto.hashToken(refreshToken),
          revoked: false,
        },
        { $set: { csrfHash: this.crypto.hashToken(csrfToken) } },
      )
      .exec();
    if (result.modifiedCount !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return csrfToken;
  }

  /** Re-issue CSRF for a valid HttpOnly refresh cookie (localStorage out of sync). */
  async resyncBrowserSession(refreshToken: string): Promise<{ csrfToken: string; user: PublicUser }> {
    const tokenHash = this.crypto.hashToken(refreshToken);
    const session = await this.sessionModel.findOne({ tokenHash, revoked: false }).exec();
    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (
      user.status === UserStatus.Banned ||
      user.status === UserStatus.Suspended
    ) {
      throw new UnauthorizedException('Account is not active');
    }
    const csrfToken = await this.protectBrowserSession(refreshToken);
    return { csrfToken, user: this.toPublic(user) };
  }

  async assertBrowserCsrf(
    refreshToken: string,
    csrfToken: string | undefined,
  ): Promise<void> {
    if (!csrfToken) {
      throw new ForbiddenException('CSRF token is required');
    }
    const session = await this.sessionModel
      .findOne({
        tokenHash: this.crypto.hashToken(refreshToken),
        csrfHash: this.crypto.hashToken(csrfToken),
        revoked: false,
      })
      .select('+csrfHash')
      .exec();
    if (!session) {
      throw new ForbiddenException('Invalid CSRF token');
    }
  }

  /** Resolve the current user embedded in a valid access JWT. */
  async verifyAccessTokenUser(accessToken: string): Promise<PublicUser | null> {
    try {
      const accessSecret = this.config.getOrThrow<string>('jwt.accessSecret');
      const payload = await this.jwt.verifyAsync<JwtPayload>(accessToken, {
        secret: accessSecret,
      });
      if (!payload?.sub) return null;
      const user = await this.users.findById(payload.sub);
      return user ? this.toPublic(user) : null;
    } catch {
      return null;
    }
  }

  async verifyEmail(dto: VerifyEmailDto, meta: SessionMeta): Promise<AuthResult> {
    const record = await this.tokenModel
      .findOne({
        email: dto.email.toLowerCase(),
        type: TokenType.EmailVerification,
        consumed: false,
      })
      .sort({ createdAt: -1 })
      .exec();

    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Please request a new code.');
    }
    if (
      !this.crypto.equalHashes(record.codeHash, this.crypto.hashToken(dto.code))
    ) {
      record.attempts += 1;
      await record.save();
      throw new BadRequestException('Invalid or expired verification code');
    }

    record.consumed = true;
    await record.save();

    if (!record.userId) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    await this.users.markEmailVerified(record.userId);

    const user = await this.users.findById(record.userId);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Send welcome email after first-time verification — best-effort.
    void this.mail
      .sendWelcome(user.email, user.profile?.firstName)
      .catch(() => undefined);

    const tokens = await this.issueTokens(user, meta);
    return { user: this.toPublic(user), ...tokens };
  }

  async requestOtp(
    dto: RequestOtpDto,
  ): Promise<OtpRequestResult> {
    await this.assertAuthEmailReady();
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      return {
        message: AUTH_OTP_REQUEST_MESSAGE,
      };
    }

    await this.assertAuthCodeResendCooldown(dto.email, TokenType.OtpLogin);
    await this.issueAndSendAuthCode({
      userId: user._id,
      email: dto.email,
      type: TokenType.OtpLogin,
    });
    return {
      message: AUTH_OTP_REQUEST_MESSAGE,
    };
  }

  async resendEmailVerification(
    email: string,
  ): Promise<{ message: string }> {
    await this.assertAuthEmailReady();
    const user = await this.users.findByEmail(email);
    if (user && !user.emailVerified) {
      await this.assertAuthCodeResendCooldown(
        email,
        TokenType.EmailVerification,
      );
      await this.issueAndSendAuthCode({
        userId: user._id,
        email,
        type: TokenType.EmailVerification,
      });
    }
    return {
      message: 'If the account exists and is unverified, a code has been sent.',
    };
  }

  async requestPasswordReset(
    dto: RequestPasswordResetDto,
  ): Promise<PasswordResetRequestResult> {
    const readiness = await this.mail.getPasswordResetReadiness();
    if (!readiness.ready) {
      throw new ServiceUnavailableException(
        readiness.message ??
          'Email service is temporarily unavailable. Please try again later.',
      );
    }

    const user = await this.users.findByEmail(dto.email);
    if (
      user &&
      !user.isGuest &&
      user.status !== UserStatus.Banned &&
      user.status !== UserStatus.Suspended
    ) {
      try {
        await this.assertAuthCodeResendCooldown(
          dto.email,
          TokenType.PasswordReset,
        );
        void this.issueAndSendPasswordResetCode({
          userId: user._id,
          email: user.email,
        }).catch((err) => {
          this.logger.error(
            `Password reset email failed for ${user.email}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
      } catch (err) {
        if (
          err instanceof HttpException &&
          err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
        ) {
          return { message: PASSWORD_RESET_REQUEST_MESSAGE };
        }
        throw err;
      }
    }

    return { message: PASSWORD_RESET_REQUEST_MESSAGE };
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<PasswordResetConfirmResult> {
    const record = await this.tokenModel
      .findOne({
        email: dto.email.toLowerCase(),
        type: TokenType.PasswordReset,
        consumed: false,
      })
      .sort({ createdAt: -1 })
      .exec();
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset code');
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        'Too many attempts. Request a new reset code.',
      );
    }
    if (
      !this.crypto.equalHashes(record.codeHash, this.crypto.hashToken(dto.code))
    ) {
      record.attempts += 1;
      await record.save();
      throw new BadRequestException('Invalid or expired reset code');
    }

    record.consumed = true;
    await record.save();

    if (!record.userId) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    await this.users.applyPasswordReset(String(record.userId), dto.password);

    return { message: PASSWORD_RESET_CONFIRM_MESSAGE };
  }

  async verifyOtp(dto: VerifyOtpDto, meta: SessionMeta): Promise<AuthResult> {
    const record = await this.tokenModel
      .findOne({
        email: dto.email.toLowerCase(),
        type: TokenType.OtpLogin,
        consumed: false,
      })
      .sort({ createdAt: -1 })
      .exec();
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts');
    }
    if (
      !this.crypto.equalHashes(record.codeHash, this.crypto.hashToken(dto.code))
    ) {
      record.attempts += 1;
      await record.save();
      throw new UnauthorizedException('Invalid or expired code');
    }
    record.consumed = true;
    await record.save();

    if (!record.userId) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    const user = await this.users.findById(record.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    // Successful OTP also confirms email ownership.
    if (!user.emailVerified) {
      await this.users.markEmailVerified(user._id);
    }
    const tokens = await this.issueTokens(user, meta);
    return { user: this.toPublic(user), ...tokens };
  }

  getPanelConfig() {
    return this.panelSettings.getConfig();
  }

  async guestSession(meta: SessionMeta): Promise<AuthResult> {
    const config = await this.panelSettings.getConfig();
    if (!config.checkout.allowGuestCheckout) {
      throw new ForbiddenException('Guest checkout is disabled');
    }
    const user = await this.users.createGuestUser();
    const tokens = await this.issueTokens(user, meta);
    return { user: this.toPublic(user), ...tokens };
  }

  async guestChatSession(
    displayName: string,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    const config = await this.panelSettings.getConfig();
    if (!config.checkout.allowGuestChat) {
      throw new ForbiddenException('Guest chat is disabled');
    }
    const user = await this.users.createGuestUser(displayName.trim());
    const tokens = await this.issueTokens(user, meta);
    return { user: this.toPublic(user), ...tokens };
  }

  private async issueTokens(
    user: UserDocument,
    meta: SessionMeta,
    opts?: { accessTtlOverride?: number; refreshTtlOverride?: number },
  ): Promise<AuthTokens> {
    const accessSecret = this.config.getOrThrow<string>('jwt.accessSecret');
    const configuredAccess =
      this.config.get<number>('jwt.accessTtl') ?? LONG_SESSION_TTL_SECONDS;
    const defaultRefreshTtl = user.isGuest
      ? (this.config.get<number>('jwt.guestRefreshTtl') ?? 86400)
      : (this.config.get<number>('jwt.refreshTtl') ??
        LONG_SESSION_TTL_SECONDS);
    const accessTtl =
      opts?.accessTtlOverride ??
      (user.isGuest
        ? Math.min(configuredAccess, defaultRefreshTtl)
        : configuredAccess);
    const refreshTtl = opts?.refreshTtlOverride ?? defaultRefreshTtl;

    const payload: JwtPayload = {
      sub: String(user._id),
      email: user.email,
      roles: user.roles,
      ver: user.tokenVersion ?? 0,
      ...(user.isGuest ? { isGuest: true } : {}),
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTtl,
    });

    const refreshToken = this.crypto.generateToken();
    await this.sessionModel.create({
      userId: user._id,
      tokenHash: this.crypto.hashToken(refreshToken),
      userAgent: meta.userAgent,
      ip: meta.ip,
      expiresAt: new Date(Date.now() + refreshTtl * 1000),
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  private async assertAuthEmailReady(): Promise<void> {
    const status = await this.mail.getAuthEmailReadiness();
    if (!status.ready) {
      throw new ServiceUnavailableException(
        status.message ??
          'Email service is temporarily unavailable. Please try again later.',
      );
    }
  }

  private authCodeTtlMs(
    type: TokenType.OtpLogin | TokenType.EmailVerification | TokenType.PasswordReset,
  ): number {
    switch (type) {
      case TokenType.OtpLogin:
        return OTP_TTL_MS;
      case TokenType.EmailVerification:
        return EMAIL_VERIFICATION_TTL_MS;
      case TokenType.PasswordReset:
        return PASSWORD_RESET_TTL_MS;
      default:
        return EMAIL_VERIFICATION_TTL_MS;
    }
  }

  private async assertAuthCodeResendCooldown(
    email: string,
    type: TokenType.OtpLogin | TokenType.EmailVerification | TokenType.PasswordReset,
  ): Promise<void> {
    const ttlMs = this.authCodeTtlMs(type);
    const cooldownBoundaryMs =
      Date.now() + ttlMs - OTP_RESEND_COOLDOWN_MS;
    const recent = await this.tokenModel
      .findOne({
        email: email.toLowerCase(),
        type,
        consumed: false,
        expiresAt: { $gt: new Date(cooldownBoundaryMs) },
      })
      .sort({ expiresAt: -1 })
      .exec();

    if (!recent) {
      return;
    }

    const retryAfterMs =
      recent.expiresAt.getTime() -
      ttlMs +
      OTP_RESEND_COOLDOWN_MS -
      Date.now();
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    throw new HttpException(
      {
        message: `Please wait ${retryAfterSec} seconds before requesting a new code.`,
        retryAfterSeconds: retryAfterSec,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async issueAndSendAuthCode(params: {
    userId: Types.ObjectId;
    email: string;
    type: TokenType.OtpLogin | TokenType.EmailVerification;
  }): Promise<void> {
    const normalizedEmail = params.email.toLowerCase();
    const ttlMs =
      params.type === TokenType.OtpLogin ? OTP_TTL_MS : EMAIL_VERIFICATION_TTL_MS;

    await this.tokenModel.deleteMany({
      email: normalizedEmail,
      type: params.type,
      consumed: false,
    });

    const code = this.crypto.generateOtp(6);
    await this.tokenModel.create({
      userId: params.userId,
      email: normalizedEmail,
      type: params.type,
      codeHash: this.crypto.hashToken(code),
      expiresAt: new Date(Date.now() + ttlMs),
    });

    const delivery =
      params.type === TokenType.OtpLogin
        ? await this.mail.sendOtp(params.email, code)
        : await this.mail.sendEmailVerification(params.email, code);

    if (this.devCodesEnabled()) {
      this.logger.debug(
        `[DEV ONLY] ${params.type} code for ${params.email}: ${code}`,
      );
    }

    if (!delivery.delivered) {
      if (this.devCodesEnabled() && delivery.skipped) {
        // Development without SMTP — code was logged above; allow local testing.
        return;
      }
      await this.tokenModel.deleteMany({
        email: normalizedEmail,
        type: params.type,
        consumed: false,
      });
      this.logger.error(
        `Auth code not delivered for ${params.email} (${params.type}): ${
          delivery.error ?? 'skipped'
        }`,
      );
      throw new ServiceUnavailableException(
        'Unable to send verification code right now. Please try again in a few minutes.',
      );
    }
  }

  private async issueAndSendPasswordResetCode(params: {
    userId: Types.ObjectId;
    email: string;
  }): Promise<void> {
    const normalizedEmail = params.email.toLowerCase();

    await this.tokenModel.deleteMany({
      email: normalizedEmail,
      type: TokenType.PasswordReset,
      consumed: false,
    });

    const code = this.crypto.generateOtp(6);
    await this.tokenModel.create({
      userId: params.userId,
      email: normalizedEmail,
      type: TokenType.PasswordReset,
      codeHash: this.crypto.hashToken(code),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });

    const delivery = await this.mail.sendPasswordReset(params.email, code);

    if (this.devCodesEnabled()) {
      this.logger.debug(
        `[DEV ONLY] password_reset for ${params.email}: ${code}`,
      );
    }

    if (!delivery.delivered) {
      if (this.devCodesEnabled() && delivery.skipped) {
        return;
      }
      await this.tokenModel.deleteMany({
        email: normalizedEmail,
        type: TokenType.PasswordReset,
        consumed: false,
      });
      this.logger.error(
        `Password reset code not delivered for ${params.email}: ${
          delivery.error ?? 'skipped'
        }`,
      );
      throw new ServiceUnavailableException(
        'Unable to send reset code right now. Please try again in a few minutes.',
      );
    }
  }

  private devCodesEnabled(): boolean {
    const env = process.env.NODE_ENV;
    // Missing NODE_ENV is not treated as development. Production never exposes
    // codes. Local development keeps the convenience of returning them. Any
    // other environment (e.g. staging) must explicitly opt in.
    if (!env || env === 'production') return false;
    if (env === 'development') return true;
    return process.env.EXPOSE_DEV_CODES === 'true';
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedUser> {
    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret) {
      throw new UnauthorizedException();
    }
    const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    if (
      user.status === UserStatus.Banned ||
      user.status === UserStatus.Suspended
    ) {
      throw new UnauthorizedException('Account is not active');
    }
    if (!accessTokenVersionMatches(payload.ver, user.tokenVersion)) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    const isGuest = isEphemeralGuestUser(user);
    return {
      id: String(user._id),
      email: user.email,
      roles: user.roles,
      ...(isGuest ? { isGuest: true } : {}),
    };
  }

  private toPublic(user: UserDocument): PublicUser {
    return {
      id: String(user._id),
      email: user.email,
      roles: user.roles as Role[],
      emailVerified: user.emailVerified,
      status: user.status,
      ...(user.isGuest ? { isGuest: true } : {}),
    };
  }
}
