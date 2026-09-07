import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProcessWithdrawalDto {
  /** true = pay out & complete; false = reject & refund the held amount. */
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
