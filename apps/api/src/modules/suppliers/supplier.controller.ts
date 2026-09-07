import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, SupplierCode } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { FulfillDto } from './dto/fulfill.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpsertSupplierDto } from './dto/upsert-supplier.dto';
import { SupplierFulfillmentService } from './supplier-fulfillment.service';
import { SupplierService } from './supplier.service';

/** Admin-only management + manual procurement for upstream suppliers. */
@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('suppliers')
export class SupplierController {
  constructor(
    private readonly suppliers: SupplierService,
    private readonly fulfillment: SupplierFulfillmentService,
  ) {}

  @Get()
  list() {
    return this.suppliers.listSuppliers();
  }

  @Post()
  upsert(@Body() dto: UpsertSupplierDto) {
    return this.suppliers.upsertSupplier(dto);
  }

  // --- Offerings (declared before :code to avoid route capture) ---

  @Get('offerings')
  listOfferings(@Query('productId') productId?: string) {
    return this.suppliers.listOfferings(productId);
  }

  @Post('offerings')
  createOffering(@Body() dto: CreateOfferingDto) {
    return this.suppliers.createOffering(dto);
  }

  @Patch('offerings/:id')
  updateOffering(@Param('id') id: string, @Body() dto: UpdateOfferingDto) {
    return this.suppliers.updateOffering(id, dto);
  }

  @Delete('offerings/:id')
  deleteOffering(@Param('id') id: string) {
    return this.suppliers.deleteOffering(id);
  }

  // --- Procurement with failover ---

  @Post('fulfill')
  fulfill(@Body() dto: FulfillDto) {
    return this.fulfillment.fulfill({
      productId: dto.productId,
      sku: dto.sku,
      quantity: dto.quantity,
      region: dto.region,
      orderId: dto.orderId,
      amount: dto.amount,
      recipient: { email: dto.recipientEmail, phone: dto.recipientPhone },
      idempotencyKey: dto.idempotencyKey,
    });
  }

  // --- Single supplier (dynamic segment last) ---

  @Get(':code/balance')
  balance(
    @Param('code', new ParseEnumPipe(SupplierCode)) code: SupplierCode,
  ) {
    return this.suppliers.refreshBalance(code);
  }

  @Patch(':code')
  update(
    @Param('code', new ParseEnumPipe(SupplierCode)) code: SupplierCode,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.updateSupplier(code, dto);
  }
}
