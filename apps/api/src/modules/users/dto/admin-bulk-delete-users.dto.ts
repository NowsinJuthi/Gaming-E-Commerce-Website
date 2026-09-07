import { ArrayMaxSize, ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

export class AdminBulkDeleteUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  ids!: string[];
}
