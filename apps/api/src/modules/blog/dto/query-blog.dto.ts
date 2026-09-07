import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

import { BlogStatus } from '../../../common/enums/blog.enum';



export class QueryBlogDto extends PaginationDto {

  @IsOptional()

  @IsEnum(BlogStatus)

  status?: BlogStatus;



  @IsOptional()

  @IsMongoId()

  categoryId?: string;



  @IsOptional()

  @IsString()

  @MaxLength(100)

  category?: string;



  @IsOptional()

  @IsString()

  @MaxLength(100)

  categorySlug?: string;



  @IsOptional()

  @IsString()

  @MaxLength(100)

  tag?: string;



  @IsOptional()

  @IsString()

  @MaxLength(200)

  q?: string;

}



export class QueryPublicBlogDto extends PaginationDto {

  @IsOptional()

  @IsMongoId()

  categoryId?: string;



  @IsOptional()

  @IsString()

  @MaxLength(100)

  category?: string;



  @IsOptional()

  @IsString()

  @MaxLength(100)

  categorySlug?: string;



  @IsOptional()

  @IsString()

  @MaxLength(100)

  tag?: string;



  @IsOptional()

  @IsString()

  @MaxLength(200)

  q?: string;

}


