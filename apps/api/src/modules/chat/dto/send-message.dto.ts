import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsMongoId()
  roomId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;
}
