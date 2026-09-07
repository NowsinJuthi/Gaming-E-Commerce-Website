import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TicketMessageDocument = HydratedDocument<TicketMessage>;

@Schema({ timestamps: true, collection: 'ticket_messages' })
export class TicketMessage {
  @Prop({ type: Types.ObjectId, ref: 'Ticket', required: true, index: true })
  ticketId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;

  @Prop({ required: true })
  senderRole!: string;

  @Prop({ required: true })
  body!: string;

  /** Staff-only note, hidden from the customer. */
  @Prop({ default: false })
  internal!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TicketMessageSchema =
  SchemaFactory.createForClass(TicketMessage);

TicketMessageSchema.index({ ticketId: 1, createdAt: 1 });
