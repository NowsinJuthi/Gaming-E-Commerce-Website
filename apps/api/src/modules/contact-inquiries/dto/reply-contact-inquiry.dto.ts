import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyContactInquiryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;
}
