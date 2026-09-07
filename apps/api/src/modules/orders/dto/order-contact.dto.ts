import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OrderContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  mobile!: string;

  @IsEmail()
  email!: string;
}
