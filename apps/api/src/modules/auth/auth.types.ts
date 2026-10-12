import { Role } from '../../common/enums';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  isGuest?: boolean;
  ver?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Role[];
  isGuest?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  roles: Role[];
  emailVerified: boolean;
  status: string;
  isGuest?: boolean;
}

export interface AuthResult extends AuthTokens {
  user: PublicUser;
}

/** Returned by register() when the account is pending email verification. */
export interface RegisterResult {
  requiresVerification: true;
  email: string;
}

/** Enumeration-safe response returned by requestOtp(). */
export interface OtpRequestResult {
  message: string;
}

export interface PasswordResetRequestResult {
  message: string;
}

export interface PasswordResetConfirmResult {
  message: string;
}
