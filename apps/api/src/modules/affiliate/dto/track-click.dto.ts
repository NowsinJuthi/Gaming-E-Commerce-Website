import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackClickDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  landingPath?: string;
}
