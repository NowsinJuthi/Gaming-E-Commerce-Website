import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Role, UserStatus } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  ASSIGNABLE_USER_ROLES,
  normalizeAssignedRoles,
} from '../../../common/utils/role.utils';

export class QueryAdminUsersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeAssignedRoles([value])[0] : value,
  )
  @IsIn(ASSIGNABLE_USER_ROLES)
  role?: Role;

  /** true = wallet balance &gt; 0, false = no balance. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasBalance?: boolean;
}
