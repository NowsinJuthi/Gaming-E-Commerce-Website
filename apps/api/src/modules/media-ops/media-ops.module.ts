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
import { AuthModule } from '../auth/auth.module';
import { CustomerPanelModule } from '../customer-panel/customer-panel.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { MediaPlaybackAccessService } from './media-playback-access.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { MediaOpsController } from './media-ops.controller';
import { MediaOpsService } from './media-ops.service';
import { LibraryIndexService } from './library-index.service';
import { MediaPlaybackController } from './media-playback.controller';
import { MediaPlaybackService } from './media-playback.service';
import { SmbClientService } from './smb-client.service';
import { SmbMountService } from './smb-mount.service';
import { TmdbMetadataService } from './tmdb-metadata.service';
import { MovieServerHostMetricsService } from './movie-server-host-metrics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MediaLibrary.name, schema: MediaLibrarySchema },
      { name: SmbServer.name, schema: SmbServerSchema },
      { name: CatalogTitle.name, schema: CatalogTitleSchema },
    ]),
    CryptoModule,
    CustomerPanelModule,
    AuthModule,
    RolePermissionsModule,
  ],
  controllers: [MediaOpsController, CatalogController, MediaPlaybackController],
  providers: [
    MediaPlaybackAccessService,
    MediaOpsService,
    SmbClientService,
    SmbMountService,
    CatalogService,
    LibraryIndexService,
    TmdbMetadataService,
    MediaPlaybackService,
    MovieServerHostMetricsService,
  ],
})
export class MediaOpsModule {}
