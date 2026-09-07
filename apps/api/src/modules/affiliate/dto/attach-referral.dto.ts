import { IsString, MaxLength } from 'class-validator';

export class AttachReferralDto {
  @IsString()
  @MaxLength(40)
  code!: string;
}
