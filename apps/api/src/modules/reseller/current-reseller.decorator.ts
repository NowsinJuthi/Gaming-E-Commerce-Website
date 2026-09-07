import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ResellerDocument } from '../../database/schemas/reseller.schema';

/** Injects the reseller resolved by the API-key guard into a handler. */
export const CurrentReseller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as Request & { reseller?: ResellerDocument }).reseller;
  },
);
