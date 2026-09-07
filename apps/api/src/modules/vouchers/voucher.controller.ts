import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { VoucherService } from './voucher.service';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('vouchers')
export class VoucherController {
  constructor(private readonly vouchers: VoucherService) {}

  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchers.create(dto);
  }

  @Get()
  list() {
    return this.vouchers.list();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vouchers.remove(id);
  }
}
