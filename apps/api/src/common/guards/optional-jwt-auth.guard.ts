import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Validates JWT when present; never blocks the request when missing or invalid. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return (super.canActivate(context) as Promise<boolean>).catch(() => true);
  }

  override handleRequest<TUser>(
    err: unknown,
    user: TUser,
  ): TUser | undefined {
    if (err || !user) {
      return undefined;
    }
    return user;
  }
}
