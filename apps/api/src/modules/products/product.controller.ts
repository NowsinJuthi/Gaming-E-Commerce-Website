import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common/pipes';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums';
import { AddInventoryDto } from './dto/add-inventory.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PRODUCT_IMAGE_UPLOAD_MAX_BYTES } from '../../shared/uploads/product-image-upload.constants';
import {
  productImageUploadMulterOptions,
  validateProductImageUploadFile,
} from '../../shared/uploads/product-image-upload.multer';
import { processProductImageUpload } from '../../shared/uploads/product-image.processor';
import { UploadsService } from '../../shared/uploads/uploads.service';
import { ProductService } from './product.service';
import { StockService } from './stock.service';

@Controller('products')
export class ProductController {
  constructor(
    private readonly products: ProductService,
    private readonly stock: StockService,
    private readonly uploads: UploadsService,
  ) {}

  @Public()
  @Get('homepage-sections')
  homepageSections(
    @Query('limit') limit?: string,
    @Query('featuredOnly') featuredOnly?: string,
  ) {
    const perCategory = limit ? Math.min(Math.max(parseInt(limit, 10) || 6, 1), 20) : 6;
    const featured =
      featuredOnly === undefined || featuredOnly === ''
        ? undefined
        : featuredOnly === 'true' || featuredOnly === '1';
    return this.products.getHomepageSections(perCategory, featured);
  }

  @Public()
  @Get()
  list(@Query() query: QueryProductDto) {
    return this.products.list(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier, Role.Support)
  @Get('admin/list')
  adminList(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
  ) {
    return this.products.adminList({ search, status, categoryId, brandId });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier)
  @Post('admin/image-upload')
  @UseInterceptors(FileInterceptor('file', productImageUploadMulterOptions))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: PRODUCT_IMAGE_UPLOAD_MAX_BYTES }),
        ],
        errorHttpStatusCode: 400,
      }),
    )
    file: Express.Multer.File,
  ) {
    validateProductImageUploadFile(file);
    try {
      const filename = await processProductImageUpload(file);
      const url = this.uploads.buildProductImagePublicUrl(filename);
      return { url, filename };
    } catch (err) {
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier, Role.Support)
  @Get('admin/:id')
  adminById(@Param('id') id: string) {
    return this.products.findByIdAdmin(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier, Role.Support)
  @Get(':id/inventory')
  listInventory(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('variationValueId') variationValueId?: string,
    @Query('search') search?: string,
  ) {
    return this.stock.listInventory(id, {
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      variationValueId,
      search,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier)
  @Post(':id/inventory')
  addInventory(@Param('id') id: string, @Body() dto: AddInventoryDto) {
    return this.stock.addInventory(
      id,
      dto.values,
      dto.cost,
      dto.variationValueId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier)
  @Patch(':id/inventory/:itemId')
  updateInventoryItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.stock.updateInventoryItem(id, itemId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier)
  @Delete(':id/inventory/unassigned')
  deleteUnassignedInventory(@Param('id') id: string) {
    return this.stock.deleteUnassignedInventory(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier)
  @Delete(':id/inventory/:itemId')
  deleteInventoryItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.stock.deleteInventoryItem(id, itemId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Supplier, Role.Support)
  @Get(':id/stock')
  getStock(
    @Param('id') id: string,
    @Query('variationValueId') variationValueId?: string,
  ) {
    return this.stock.getStock(id, variationValueId);
  }

  @Public()
  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }
}
