import { IsIn, IsString } from 'class-validator';
import type { BlogReactionType } from '../../../database/schemas/blog-reaction.schema';

export class SetBlogReactionDto {
  @IsString()
  @IsIn(['like', 'dislike'])
  type!: BlogReactionType;
}
