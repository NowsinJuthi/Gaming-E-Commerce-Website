import { IsString, MaxLength, MinLength } from 'class-validator';

export class ApplyResellerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;
}
