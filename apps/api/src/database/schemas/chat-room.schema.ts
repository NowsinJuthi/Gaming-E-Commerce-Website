import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ChatRoomStatus, ChatRoomType } from '../../common/enums';

export type ChatRoomDocument = HydratedDocument<ChatRoom>;

@Schema({ timestamps: true, collection: 'chat_rooms' })
export class ChatRoom {
  @Prop({
    type: String,
    enum: Object.values(ChatRoomType),
    default: ChatRoomType.Support,
    index: true,
  })
  type!: ChatRoomType;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true })
  participants!: Types.ObjectId[];

  @Prop({
    type: String,
    enum: Object.values(ChatRoomStatus),
    default: ChatRoomStatus.Open,
    index: true,
  })
  status!: ChatRoomStatus;

  @Prop()
  subject?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  /** Support agent currently handling the room. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedAdminId?: Types.ObjectId;

  @Prop()
  lastMessage?: string;

  @Prop()
  lastMessageAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastSenderId?: Types.ObjectId;

  /** Set atomically when the one-time welcome auto-reply is claimed. */
  @Prop()
  welcomeAutoReplySentAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);

ChatRoomSchema.index({ participants: 1, lastMessageAt: -1 });
ChatRoomSchema.index(
  { createdBy: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: ChatRoomType.Support,
      status: ChatRoomStatus.Open,
    },
  },
);
