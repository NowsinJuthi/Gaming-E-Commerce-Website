import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SequenceCounterDocument = HydratedDocument<SequenceCounter>;

@Schema({ collection: 'sequence_counters' })
export class SequenceCounter {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true, default: 0 })
  seq!: number;
}

export const SequenceCounterSchema =
  SchemaFactory.createForClass(SequenceCounter);
