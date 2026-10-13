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
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApproveMfsIntentDto } from './dto/approve-mfs-intent.dto';
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
import { processMfsQrImageUpload } from '../../shared/uploads/mfs-qr-image.processor';
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
    return this.verification.selectGateway(user.id, intentId, dto.gatewayId);
  }

  @Post('checkout/:intentId/reset-gateway')
  resetGateway(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intentId') intentId: string,
  ) {
    return this.verification.resetGateway(user.id, intentId);
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
    return this.verification.removeCheckoutItem(user.id, intentId, index);
  }

  @Post('checkout/:intentId/trx')
  submitTrx(
    @CurrentUser() user: AuthenticatedUser,
    @Param('intentId') intentId: string,
    @Body() dto: SubmitMfsTrxDto,
  ) {
    return this.verification.submitTrxId(user.id, intentId, dto.trxId);
  }

  @Public()
  @Post('sms/sync')
  syncSms(@Req() req: Request, @Body() body: unknown) {
    this.verification.assertSmsSyncToken(smsToken(req));
    return this.verification.syncSms(body);
  }
}

@UseGuards(RolesGuard)
@Roles(Role.Admin, Role.Support, Role.ShopManager)
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
  @Roles(Role.Admin, Role.ShopManager)
  createGateway(@Body() dto: CreateMfsGatewayDto) {
    return this.gateways.create(dto);
  }

  @Patch('gateways/:id')
  @Roles(Role.Admin, Role.ShopManager)
  updateGateway(@Param('id') id: string, @Body() dto: UpdateMfsGatewayDto) {
    return this.gateways.update(id, dto);
  }

  @Delete('gateways/:id')
  @Roles(Role.Admin, Role.ShopManager)
  async deleteGateway(@Param('id') id: string) {
    await this.gateways.remove(id);
    return { ok: true };
  }

  @Post('gateways/qr-upload')
  @Roles(Role.Admin, Role.ShopManager)
  @UseInterceptors(FileInterceptor('file', mfsQrUploadMulterOptions))
  async uploadQr(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MFS_QR_UPLOAD_MAX_BYTES })],
      }),
    )
    file: Express.Multer.File,
  ) {
    validateMfsQrUploadFile(file);
    const filename = await processMfsQrImageUpload(file);
    const url = this.uploads.buildMfsQrPublicUrl(filename);
    return { url, filename };
  }

  @Get('sms-logs')
  listSmsLogs(
    @Query('status') status?: SmsLogStatus,
    @Query('trxId') trxId?: string,
  ) {
    if (status && !Object.values(SmsLogStatus).includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    return this.verification.listSmsLogs({
      status,
      trxId: trxId?.trim().slice(0, 64),
    });
  }

  @Post('sms-logs/bulk-delete')
  @Roles(Role.Admin, Role.ShopManager)
  bulkDeleteSmsLogs(@Body() dto: DeleteSmsLogsDto) {
    if (!dto.ids?.length && !dto.trxIds?.length) {
      throw new BadRequestException('No SMS logs selected');
    }
    return this.verification.deleteSmsLogs(dto.ids, dto.trxIds);
  }

  @Post('sms-logs/bulk-status')
  @Roles(Role.Admin, Role.ShopManager)
  bulkUpdateSmsLogsStatus(@Body() dto: BulkUpdateSmsLogsStatusDto) {
    return this.verification.bulkUpdateSmsLogStatus(dto.ids, dto.status);
  }

  @Patch('sms-logs/:id')
  @Roles(Role.Admin, Role.ShopManager)
  updateSmsLogStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSmsLogStatusDto,
  ) {
    return this.verification.updateSmsLogStatus(id, dto.status);
  }

  @Delete('sms-logs/:id')
  @Roles(Role.Admin, Role.ShopManager)
  deleteSmsLog(@Param('id') id: string) {
    return this.verification.deleteSmsLog(id);
  }

  @Get('intents')
  listIntents(@Query('status') status?: PaymentIntentStatus) {
    return this.verification.listMfsIntents({ status });
  }

  @UseGuards(PermissionsGuard)
  @Roles(Role.Admin, Role.ShopManager)
  @Permissions('approve_mfs_payments')
  @Post('intents/:id/approve')
  approveIntent(
    @Param('id') id: string,
    @Body() dto: ApproveMfsIntentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.verification.adminApprove(id, user, dto.reason);
  }

  @Get('sms-formats')
  getSmsFormats() {
    return this.smsFormats.getFormats();
  }

  @Put('sms-formats')
  @Roles(Role.Admin, Role.ShopManager)
  updateSmsFormats(@Body() dto: UpdateMfsSmsFormatsDto) {
    return this.smsFormats.updateFormats(dto);
  }

  @Post('sms-formats/reset')
  @Roles(Role.Admin, Role.ShopManager)
  resetSmsFormats() {
    return this.smsFormats.resetFormats();
  }

  @Post('sms-formats/test')
  @Roles(Role.Admin, Role.ShopManager)
  testSmsFormat(@Body() dto: TestMfsSmsFormatDto) {
    return this.smsFormats.testParse(dto);
  }
}
