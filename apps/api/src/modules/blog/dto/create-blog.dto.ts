import {

  IsArray,

  IsEnum,

  IsMongoId,

  IsOptional,

  IsString,

  IsUrl,

  MaxLength,

  MinLength,

} from 'class-validator';

import { BlogStatus } from '../../../common/enums/blog.enum';



export class CreateBlogDto {

  @IsString()

  @MinLength(2)

  @MaxLength(200)

  title!: string;



  @IsOptional()

  @IsString()

  @MaxLength(200)

  slug?: string;



  @IsOptional()

  @IsString()

  @MaxLength(500)

  excerpt?: string;



  @IsString()

  content!: string;



  @IsOptional()

  @IsString()

  @MaxLength(500)

  featuredImage?: string;



  @IsOptional()

  @IsMongoId()

  categoryId?: string;



  @IsOptional()

  @IsString()

  @MaxLength(100)

  category?: string;



  @IsOptional()

  @IsArray()

  @IsString({ each: true })

  tags?: string[];



  @IsOptional()

  @IsEnum(BlogStatus)

  status?: BlogStatus;



  @IsOptional()

  @IsString()

  @MaxLength(200)

  metaTitle?: string;



  @IsOptional()

  @IsString()

  @MaxLength(500)

  metaDescription?: string;



  @IsOptional()

  @IsString()

  @MaxLength(100)

  focusKeyword?: string;



  @IsOptional()

  @IsUrl({ require_protocol: true }, { message: 'canonicalUrl must be a valid URL' })

  @MaxLength(500)

  canonicalUrl?: string;



  @IsOptional()

  @IsString()

  @MaxLength(500)

  ogImage?: string;

}


