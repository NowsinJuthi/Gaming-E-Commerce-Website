import { ArrayMaxSize, ArrayMinSize, IsEnum, IsUrl } from 'class-validator';
import { KycDocumentType } from '../../../common/enums';

export class SubmitKycDto {
  @IsEnum(KycDocumentType)
  documentType!: KycDocumentType;

  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  fileUrls!: string[];
}
