import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TicketPriority, TicketStatus } from '../../common/enums';

export type TicketDocument = HydratedDocument<Ticket>;

@Schema({ timestamps: true, collection: 'tickets' })
export class Ticket {
  @Prop({ required: true, unique: true })
  ticketNumber!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  subject!: string;

  @Prop()
  category?: string;

  @Prop({
    type: String,
    enum: Object.values(TicketPriority),
    default: TicketPriority.Medium,
  })
  priority!: TicketPriority;

  @Prop({
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.Open,
    index: true,
  })
  status!: TicketStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedAdminId?: Types.ObjectId;

  @Prop()
  lastReplyAt?: Date;

  /** 'customer' | 'staff' — who sent the last reply (drives SLA/queues). */
  @Prop()
  lastReplyBy?: string;

  @Prop()
  closedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

TicketSchema.index({ userId: 1, createdAt: -1 });
TicketSchema.index({ status: 1, createdAt: -1 });
TicketSchema.index({ assignedAdminId: 1, status: 1 });
