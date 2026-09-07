import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProductRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  productName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^[+\d][\d\s-]{6,20}$/, {
    message: 'mobile must be a valid phone number',
  })
  mobile!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  details!: string;
}
