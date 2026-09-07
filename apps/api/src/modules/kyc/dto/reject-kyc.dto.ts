import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectKycDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
