import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentGateway } from '../../common/enums';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentService } from './payment.service';

const headerValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  /**
   * Gateway webhook receiver. Public (no JWT) but every call is signature-
   * verified and audited. Uses the raw request body for HMAC validation.
   */
  @Public()
  @Post('webhooks/:gateway')
  @HttpCode(200)
  webhook(
    @Param('gateway', new ParseEnumPipe(PaymentGateway))
    gateway: PaymentGateway,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const signature =
      headerValue(req.headers['x-signature']) ??
      headerValue(req.headers['x-webhook-signature']) ??
      headerValue(req.headers['signature']) ??
      headerValue(req.headers['verify-signature']);
    return this.payments.handleWebhook(
      gateway,
      req.body,
      signature,
      req.rawBody,
      req.ip,
    );
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    return this.payments.createPayment(user, dto, req.ip);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.getOne(user, id);
  }

  @Post(':id/verify')
  verify(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.verifyPayment(user, id);
  }
}
