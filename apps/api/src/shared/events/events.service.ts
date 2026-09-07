import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { AppEvent, EventPayloadMap } from './events.types';

/**
 * Central emitter for real-time store events.
 *
 * Import EventsModule into any feature module that needs to broadcast events,
 * then inject EventsService and call `emit(AppEvent.Xyz, payload)`.
 *
 * The underlying Socket.IO server is wired in by EventsGateway.afterInit()
 * once the WebSocket server is ready.  Calls before that point are no-ops —
 * safe during early module initialisation.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private server: Server | null = null;

  /** Called by EventsGateway once the Socket.IO server is ready. */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Broadcast an event to ALL clients connected to the /events namespace.
   * Payload type is inferred from the event name via EventPayloadMap.
   */
  emit<E extends AppEvent>(event: E, payload: EventPayloadMap[E]): void {
    if (!this.server) {
      this.logger.warn(`EventsService.emit called before gateway init — dropped: ${event}`);
      return;
    }
    this.server.emit(event, payload);
  }
}
