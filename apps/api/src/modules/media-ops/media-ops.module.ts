import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CatalogTitle,
  CatalogTitleSchema,
} from '../../database/schemas/catalog-title.schema';
import {
  MediaLibrary,
  MediaLibrarySchema,
} from '../../database/schemas/media-library.schema';
import { SmbServer, SmbServerSchema } from '../../database/schemas/smb-server.schema';
import { CryptoModule } from '../../shared/crypto/crypto.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { MediaOpsController } from './media-ops.controller';
import { MediaOpsService } from './media-ops.service';
import { LibraryIndexService } from './library-index.service';
import { SmbClientService } from './smb-client.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MediaLibrary.name, schema: MediaLibrarySchema },
      { name: SmbServer.name, schema: SmbServerSchema },
      { name: CatalogTitle.name, schema: CatalogTitleSchema },
    ]),
    CryptoModule,
  ],
  controllers: [MediaOpsController, CatalogController],
  providers: [MediaOpsService, SmbClientService, CatalogService, LibraryIndexService],
})
export class MediaOpsModule {}
