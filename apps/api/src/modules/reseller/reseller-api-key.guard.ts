import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ResellerDocument } from '../../database/schemas/reseller.schema';
import { ResellerService } from './reseller.service';

/**
 * Authenticates programmatic reseller requests via the `x-api-key` header and
 * attaches the resolved reseller to the request. Used on the public API
 * controller (which bypasses the global JWT guard).
 */
@Injectable()
export class ResellerApiKeyGuard implements CanActivate {
  constructor(private readonly reseller: ResellerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-api-key'];
    const key = Array.isArray(header) ? header[0] : header;
    if (!key) {
      throw new UnauthorizedException('Missing API key');
    }
    const reseller = await this.reseller.authenticateApiKey(key);
    (request as Request & { reseller?: ResellerDocument }).reseller = reseller;
    return true;
  }
}
