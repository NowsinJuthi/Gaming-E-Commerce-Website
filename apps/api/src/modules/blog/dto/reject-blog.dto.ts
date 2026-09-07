import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectBlogDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
