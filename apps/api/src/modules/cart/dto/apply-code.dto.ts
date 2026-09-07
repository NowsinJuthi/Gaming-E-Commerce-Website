import { IsString, Length } from 'class-validator';

export class ApplyCodeDto {
  @IsString()
  @Length(3, 32)
  code!: string;
}
