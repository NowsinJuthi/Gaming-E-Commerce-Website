import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LONG_SESSION_TTL_SECONDS } from '../../config/session-ttl';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RecaptchaGuard } from '../../security/recaptcha.guard';
import { AuthService } from './auth.service';
import type {
  AuthenticatedUser,
  AuthResult,
  AuthTokens,
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
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  accessCookieOptions,
  isBrowserAuthRequest,
  omitSecretsFromBrowserSession,
  readNamedCookie,
  refreshCookieOptions,
} from './auth-cookies';

@Controller('auth')
export class AuthController {
  private readonly refreshCookieName = REFRESH_COOKIE_NAME;

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @UseGuards(RecaptchaGuard)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @UseGuards(RecaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, this.meta(req));
    return this.respondWithSession(result, req, res);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('browser-session/resync')
  async resyncBrowserSession(@Req() req: Request) {
    const cookieToken = this.readCookie(req, this.refreshCookieName);
    if (!cookieToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    if (
      !isBrowserAuthRequest({
        origin: req.headers.origin,
        cookie: req.headers.cookie,
      })
    ) {
      throw new UnauthorizedException('Browser session required');
    }
    const result = await this.auth.resyncBrowserSession(cookieToken);
    const accessMaxAge = this.config.get<number>('jwt.accessTtl') ?? 900;
    return omitSecretsFromBrowserSession({
      csrfToken: result.csrfToken,
      user: result.user,
      expiresIn: accessMaxAge,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = this.readCookie(req, this.refreshCookieName);
    const refreshToken = cookieToken ?? dto.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    if (cookieToken) {
      await this.auth.assertBrowserCsrf(
        refreshToken,
        this.header(req, 'x-csrf-token'),
      );
    }
    const result = await this.auth.refresh(
      { refreshToken },
      this.meta(req),
    );
    return cookieToken || isBrowserAuthRequest({
      origin: req.headers.origin,
      cookie: req.headers.cookie,
    })
      ? this.toBrowserSession(result, res)
      : result;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = this.readCookie(req, this.refreshCookieName);
    const refreshToken = cookieToken ?? dto.refreshToken;
    if (cookieToken) {
      await this.auth.assertBrowserCsrf(
        cookieToken,
        this.header(req, 'x-csrf-token'),
      );
    }
    const result = await this.auth.logout({ refreshToken });
    this.clearRefreshCookie(res);
    return result;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyEmail(dto, this.meta(req));
    return this.respondWithSession(result, req, res);
  }

  @Public()
  @UseGuards(RecaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @UseGuards(RecaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Body() dto: RequestOtpDto) {
    return this.auth.resendEmailVerification(dto.email);
  }

  @Public()
  @UseGuards(RecaptchaGuard)
  @HttpCode(HttpStatus.OK)
  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('password-reset/confirm')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('otp/verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtp(dto, this.meta(req));
    return this.respondWithSession(result, req, res);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('guest')
  async guest(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.guestSession(this.meta(req));
    return this.respondWithSession(result, req, res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  private meta(req: Request): SessionMeta {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  private async respondWithSession(
    result: AuthResult | AuthTokens,
    req: Request,
    res: Response,
  ) {
    if (
      isBrowserAuthRequest({
        origin: req.headers.origin,
        cookie: req.headers.cookie,
      })
    ) {
      return this.toBrowserSession(result, res);
    }
    return result;
  }

  private async toBrowserSession(
    result: AuthResult | AuthTokens,
    res: Response,
  ) {
    const csrfToken = await this.auth.protectBrowserSession(
      result.refreshToken,
    );
    const production = this.config.get<string>('app.env') === 'production';
    const isGuest =
      'user' in result && result.user.isGuest === true;
    const refreshMaxAge = isGuest
      ? (this.config.get<number>('jwt.guestRefreshTtl') ?? 86_400)
      : (this.config.get<number>('jwt.refreshTtl') ?? LONG_SESSION_TTL_SECONDS);
    const accessMaxAge = this.config.get<number>('jwt.accessTtl') ?? 900;
    const domain = this.authCookieDomain();
    res.cookie(
      ACCESS_COOKIE_NAME,
      result.accessToken,
      accessCookieOptions({ production, maxAgeSeconds: accessMaxAge, domain }),
    );
    res.cookie(
      this.refreshCookieName,
      result.refreshToken,
      refreshCookieOptions({
        production,
        path: this.authCookiePath(),
        maxAgeSeconds: refreshMaxAge,
        domain,
      }),
    );
    return omitSecretsFromBrowserSession({ ...result, csrfToken });
  }

  private clearRefreshCookie(res: Response): void {
    const production = this.config.get<string>('app.env') === 'production';
    const domain = this.authCookieDomain();
    res.clearCookie(this.refreshCookieName, {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: this.authCookiePath(),
      ...(domain ? { domain } : {}),
    });
    res.clearCookie(ACCESS_COOKIE_NAME, {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
    });
  }

  private authCookieDomain(): string | null {
    return this.config.get<string | null>('app.authCookieDomain') ?? null;
  }

  private authCookiePath(): string {
    const prefix = this.config.get<string>('app.globalPrefix') ?? 'api';
    return `/${prefix.replace(/^\/+|\/+$/g, '')}/auth`;
  }

  private readCookie(req: Request, name: string): string | undefined {
    return readNamedCookie(req.headers.cookie, name);
  }

  private header(req: Request, name: string): string | undefined {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
