import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AdminUpdateMediaPlanDto, AdminUpsertMediaPlanDto } from './dto/admin-plan.dto';
import { MediaPlansService } from './media-plans.service';

@Controller('admin/media/plans')
@UseGuards(RolesGuard)
@Roles(Role.Administrator, Role.Admin)
export class AdminMediaPlansController {
  constructor(private readonly plans: MediaPlansService) {}

  @Get()
  async list() {
    const plans = await this.plans.listAll();
    return { plans: plans.map((plan) => this.plans.toPublic(plan)) };
  }

  @Post()
  async create(@Body() dto: AdminUpsertMediaPlanDto) {
    const plan = await this.plans.create(dto);
    return { plan: this.plans.toPublic(plan) };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: AdminUpdateMediaPlanDto,
  ) {
    const plan = await this.plans.update(String(id), dto);
    return { plan: this.plans.toPublic(plan) };
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    const plan = await this.plans.deactivate(String(id));
    return { plan: this.plans.toPublic(plan), message: 'Plan disabled for new signups.' };
  }
}
