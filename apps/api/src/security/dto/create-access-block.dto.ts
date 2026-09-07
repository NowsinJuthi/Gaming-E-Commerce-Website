import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AccessBlockType } from '../../database/schemas/access-block.schema';

export class CreateAccessBlockDto {
  @IsIn(['ip', 'country'])
  type!: AccessBlockType;

  @IsString()
  @MinLength(2)
  @MaxLength(45)
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
