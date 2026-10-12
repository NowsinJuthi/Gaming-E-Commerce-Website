import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MediaLibrary,
  MediaLibrarySchema,
} from '../../database/schemas/media-library.schema';
import { SmbServer, SmbServerSchema } from '../../database/schemas/smb-server.schema';
import { CryptoModule } from '../../shared/crypto/crypto.module';
import { MediaOpsController } from './media-ops.controller';
import { MediaOpsService } from './media-ops.service';
import { SmbClientService } from './smb-client.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MediaLibrary.name, schema: MediaLibrarySchema },
      { name: SmbServer.name, schema: SmbServerSchema },
    ]),
    CryptoModule,
  ],
  controllers: [MediaOpsController],
  providers: [MediaOpsService, SmbClientService],
})
export class MediaOpsModule {}
