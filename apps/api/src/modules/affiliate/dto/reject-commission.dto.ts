import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectCommissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
