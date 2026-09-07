import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RolePermissionsService } from './role-permissions.service';

@Controller('role-permissions/admin')
@UseGuards(RolesGuard)
@Roles(Role.Admin)
export class RolePermissionsAdminController {
  constructor(private readonly service: RolePermissionsService) {}

  @Get()
  overview() {
    return this.service.getOverview();
  }

  @Patch('roles/:roleId')
  updateRole(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.service.updateRole(roleId, dto.permissions ?? {});
  }

  @Post('roles/:roleId/reset')
  resetRole(@Param('roleId') roleId: string) {
    return this.service.resetRole(roleId);
  }

  @Post('reset')
  resetAll() {
    return this.service.resetAll();
  }
}
