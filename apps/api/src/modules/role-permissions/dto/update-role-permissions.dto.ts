import { IsObject, IsOptional } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>;
}
