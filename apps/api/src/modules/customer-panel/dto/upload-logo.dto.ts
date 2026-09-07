import { IsIn, IsOptional } from 'class-validator';
import type { LogoUploadVariant } from '../../../shared/uploads/logo-upload.constants';

export class UploadLogoDto {
  @IsOptional()
  @IsIn([
    'light',
    'dark',
    'admin',
    'email',
    'footer-light',
    'footer-dark',
    'admin-favicon',
  ])
  variant?: LogoUploadVariant;
}
