import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common/pipes';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateMfsGatewayDto,
  SelectMfsGatewayDto,
  SubmitMfsTrxDto,
  UpdateMfsCheckoutItemDto,
  UpdateMfsGatewayDto,
} from './dto/mfs.dto';
import { MfsGatewayService } from './mfs-gateway.service';
import {
  isStaffUser,
  MfsVerificationService,
} from './mfs-verification.service';
import {
  mfsQrUploadMulterOptions,
  MFS_QR_UPLOAD_MAX_BYTES,
  validateMfsQrUploadFile,
} from '../../shared/uploads/mfs-qr-upload.multer';
import {
  TestMfsSmsFormatDto,
  UpdateMfsSmsFormatsDto,
} from './dto/mfs-sms-format.dto';
import { MfsSmsFormatService } from './mfs-sms-format.service';
import { UploadsService } from '../../shared/uploads/uploads.service';
import { SmsLogStatus } from '../../database/schemas/sms-log.schema';
import { PaymentIntentStatus } from '../../common/enums';
import { DeleteSmsLogsDto } from './dto/delete-sms-logs.dto';
import { BulkUpdateSmsLogsStatusDto } from './dto/bulk-update-sms-logs-status.dto';
import { UpdateSmsLogStatusDto } from './dto/update-sms-log.dto';

const smsToken = (req: Request): string | undefined => {
  const raw = req.headers['x-mfs-sms-token'];
  return Array.isArray(raw) ? raw[0] : raw;
};

@Controller('payments/mfs')
export class MfsPaymentController {
  constructor(
    private readonly verification: MfsVerificationService,
    private readonly gateways: MfsGatewayService,
  ) {}

  @Get('gateways')
  listActiveGateways() {
    return this.verification.listCheckoutGateways();
  }

  @Get('checkout/:intentId')
  getCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intentId') intentId: string,
  ) {
    return this.verification.getCheckoutSession(
      user.id,
      intentId,
      isStaffUser(user.roles),
    );
  }

  @Post('checkout/:intentId/gateway')
  selectGateway(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intentId') intentId: string,
    @Body() dto: SelectMfsGatewayDto,
  ) {
    return this.verification.selectGateway(
      user.id,
      intentId,
      dto.gatewayId,
      isStaffUser(user.roles),
    );
  }

  @Post('checkout/:intentId/reset-gateway')
  resetGateway(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intentId') intentId: string,
  ) {
    return this.verification.resetGateway(
      user.id,
      intentId,
      isStaffUser(user.roles),
    );
  }

  @Patch('checkout/:intentId/items/:itemIndex')
  updateCheckoutItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intentId') intentId: string,
    @Param('itemIndex') itemIndex: string,
    @Body() dto: UpdateMfsCheckoutItemDto,
  ) {
    const index = Number.parseInt(itemIndex, 10);
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('Invalid item index');
    }
    return this.verification.updateCheckoutItemQuantity(
      user.id,
      intentId,
      index,
      dto.quantity,
      isStaffUser(user.roles),
    );
  }

  @Delete('checkout/:intentId/items/:itemIndex')
  removeCheckoutItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intentId') intentId: string,
    @Param('itemIndex') itemIndex: string,
  ) {
    const index = Number.parseInt(itemIndex, 10);
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('Invalid item index');
    }
    return this.verification.removeCheckoutItem(
      user.id,
      intentId,
      index,
      isStaffUser(user.roles),
    );
  }

  @Post('checkout/:intentId/trx')
  submitTrx(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intentId') intentId: string,
    @Body() dto: SubmitMfsTrxDto,
  ) {
    return this.verification.submitTrxId(
      user.id,
      intentId,
      dto.trxId,
      isStaffUser(user.roles),
    );
  }

  @Public()
  @Post('sms/sync')
  syncSms(@Req() req: Request, @Body() body: unknown) {
    this.verification.assertSmsSyncToken(smsToken(req));
    return this.verification.syncSms(body);
  }
}

@UseGuards(RolesGuard)
@Roles(Role.Admin, Role.Support)
@Controller('payments/admin/mfs')
export class MfsAdminController {
  constructor(
    private readonly gateways: MfsGatewayService,
    private readonly verification: MfsVerificationService,
    private readonly uploads: UploadsService,
    private readonly smsFormats: MfsSmsFormatService,
  ) {}

  @Get('gateways')
  listGateways() {
    return this.gateways.listAll();
  }

  @Post('gateways')
  createGateway(@Body() dto: CreateMfsGatewayDto) {
    return this.gateways.create(dto);
  }

  @Patch('gateways/:id')
  updateGateway(@Param('id') id: string, @Body() dto: UpdateMfsGatewayDto) {
    return this.gateways.update(id, dto);
  }

  @Delete('gateways/:id')
  async deleteGateway(@Param('id') id: string) {
    await this.gateways.remove(id);
    return { ok: true };
  }

  @Post('gateways/qr-upload')
  @UseInterceptors(FileInterceptor('file', mfsQrUploadMulterOptions))
  uploadQr(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MFS_QR_UPLOAD_MAX_BYTES })],
      }),
    )
    file: Express.Multer.File,
  ) {
    validateMfsQrUploadFile(file);
    const url = this.uploads.buildMfsQrPublicUrl(file.filename);
    return { url, filename: file.filename };
  }

  @Get('sms-logs')
  listSmsLogs(@Query('status') status?: SmsLogStatus) {
    return this.verification.listSmsLogs({ status });
  }

  @Post('sms-logs/bulk-delete')
  bulkDeleteSmsLogs(@Body() dto: DeleteSmsLogsDto) {
    if (!dto.ids?.length && !dto.trxIds?.length) {
      throw new BadRequestException('No SMS logs selected');
    }
    return this.verification.deleteSmsLogs(dto.ids, dto.trxIds);
  }

  @Post('sms-logs/bulk-status')
  bulkUpdateSmsLogsStatus(@Body() dto: BulkUpdateSmsLogsStatusDto) {
    return this.verification.bulkUpdateSmsLogStatus(dto.ids, dto.status);
  }

  @Patch('sms-logs/:id')
  updateSmsLogStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSmsLogStatusDto,
  ) {
    return this.verification.updateSmsLogStatus(id, dto.status);
  }

  @Delete('sms-logs/:id')
  deleteSmsLog(@Param('id') id: string) {
    return this.verification.deleteSmsLog(id);
  }

  @Get('intents')
  listIntents(@Query('status') status?: PaymentIntentStatus) {
    return this.verification.listMfsIntents({ status });
  }

  @Post('intents/:id/approve')
  approveIntent(@Param('id') id: string) {
    return this.verification.adminApprove(id);
  }

  @Get('sms-formats')
  getSmsFormats() {
    return this.smsFormats.getFormats();
  }

  @Put('sms-formats')
  updateSmsFormats(@Body() dto: UpdateMfsSmsFormatsDto) {
    return this.smsFormats.updateFormats(dto);
  }

  @Post('sms-formats/reset')
  resetSmsFormats() {
    return this.smsFormats.resetFormats();
  }

  @Post('sms-formats/test')
  testSmsFormat(@Body() dto: TestMfsSmsFormatDto) {
    return this.smsFormats.testParse(dto);
  }
}
