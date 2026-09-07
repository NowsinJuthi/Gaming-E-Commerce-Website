import { PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

// Re-parenting is intentionally unsupported (would require descendant path rewrites).
export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['parentId'] as const),
) {}
