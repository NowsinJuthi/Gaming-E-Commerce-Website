import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

/**
 * Import this module in any feature module that needs to broadcast real-time
 * events.  It exports EventsService so callers can inject it directly.
 *
 * The WebSocket gateway (/events namespace) is registered globally via
 * AppModule — other feature modules only need the service export.
 */
@Module({
  imports: [
    // Empty config — secrets are read at verify time via ConfigService (same
    // pattern as ChatModule).
    JwtModule.register({}),
  ],
  providers: [EventsService, EventsGateway],
  exports: [EventsService],
})
export class EventsModule {}
