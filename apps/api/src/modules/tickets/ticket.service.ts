import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { NotificationAudience, NotificationEvent, Role, TicketStatus } from '../../common/enums';
import {
  CHAT_STAFF_ROLES,
  isAdministratorRole,
  isChatStaff,
  userHasRole,
} from '../../common/utils/role.utils';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import {
  TicketMessage,
  TicketMessageDocument,
} from '../../database/schemas/ticket-message.schema';
import { Ticket, TicketDocument } from '../../database/schemas/ticket.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';

const isStaff = (user: AuthenticatedUser): boolean => isChatStaff(user.roles);

const primaryRole = (user: AuthenticatedUser): string => {
  if (user.roles.some(isAdministratorRole)) return Role.Administrator;
  if (userHasRole(user.roles, Role.Editor)) return Role.Editor;
  return user.roles[0] ?? Role.Customer;
};

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
    @InjectModel(TicketMessage.name)
    private readonly messageModel: Model<TicketMessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  // --- Create ---

  async create(
    user: AuthenticatedUser,
    dto: CreateTicketDto,
  ): Promise<TicketDocument> {
    const userId = new Types.ObjectId(user.id);
    const ticket = await this.ticketModel.create({
      ticketNumber: await this.generateTicketNumber(),
      userId,
      subject: dto.subject,
      category: dto.category,
      priority: dto.priority,
      status: TicketStatus.Open,
      lastReplyAt: new Date(),
      lastReplyBy: 'customer',
    });
    await this.messageModel.create({
      ticketId: ticket._id,
      senderId: userId,
      senderRole: primaryRole(user),
      body: dto.body,
    });
    return ticket;
  }

  // --- Reply ---

  async reply(
    user: AuthenticatedUser,
    ticketId: string,
    dto: ReplyTicketDto,
  ): Promise<TicketMessageDocument> {
    const ticket = await this.getAccessible(user, ticketId);
    const staff = isStaff(user);
    const internal = staff && dto.internal === true;

    const message = await this.messageModel.create({
      ticketId: ticket._id,
      senderId: new Types.ObjectId(user.id),
      senderRole: primaryRole(user),
      body: dto.body,
      internal,
    });

    if (!internal) {
      ticket.lastReplyAt = new Date();
      ticket.lastReplyBy = staff ? 'staff' : 'customer';
      if (staff) {
        if (!ticket.assignedAdminId) {
          ticket.assignedAdminId = new Types.ObjectId(user.id);
        }
        if (
          ticket.status === TicketStatus.Open ||
          ticket.status === TicketStatus.Pending
        ) {
          ticket.status = TicketStatus.InProgress;
        }
      } else if (
        ticket.status === TicketStatus.Resolved ||
        ticket.status === TicketStatus.Closed
      ) {
        // Customer follow-up reopens a settled ticket.
        ticket.status = TicketStatus.Open;
        ticket.closedAt = undefined;
      }
      await ticket.save();
      await this.notifyReply(ticket, user, staff);
    }

    return message;
  }

  // --- Status ---

  async updateStatus(
    ticketId: string,
    status: TicketStatus,
  ): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(ticketId).exec();
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    ticket.status = status;
    ticket.closedAt =
      status === TicketStatus.Closed || status === TicketStatus.Resolved
        ? new Date()
        : undefined;
    await ticket.save();

    await this.dispatcher.dispatch(NotificationEvent.Custom, ticket.userId, {
      title: `Ticket ${ticket.ticketNumber} ${status}`,
      body: `Your support ticket is now ${status}.`,
      ticketId: String(ticket._id),
      status,
    });
    return ticket;
  }

  // --- Admin assignment ---

  async assign(ticketId: string, adminId: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(ticketId).exec();
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    ticket.assignedAdminId = new Types.ObjectId(adminId);
    if (ticket.status === TicketStatus.Open) {
      ticket.status = TicketStatus.InProgress;
    }
    await ticket.save();

    await this.dispatcher.dispatch(
      NotificationEvent.Custom,
      ticket.assignedAdminId,
      {
        title: `Ticket ${ticket.ticketNumber} assigned to you`,
        body: `You have been assigned ticket ${ticket.ticketNumber}.`,
        ticketId: String(ticket._id),
      },
      NotificationAudience.Staff,
    );
    return ticket;
  }

  async adminOverview(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    pending: number;
    resolved: number;
    closed: number;
    unassigned: number;
  }> {
    const [total, open, inProgress, pending, resolved, closed, unassigned] =
      await Promise.all([
        this.ticketModel.countDocuments().exec(),
        this.ticketModel.countDocuments({ status: TicketStatus.Open }).exec(),
        this.ticketModel
          .countDocuments({ status: TicketStatus.InProgress })
          .exec(),
        this.ticketModel.countDocuments({ status: TicketStatus.Pending }).exec(),
        this.ticketModel.countDocuments({ status: TicketStatus.Resolved }).exec(),
        this.ticketModel.countDocuments({ status: TicketStatus.Closed }).exec(),
        this.ticketModel
          .countDocuments({ assignedAdminId: { $exists: false } })
          .exec(),
      ]);
    return {
      total,
      open,
      inProgress,
      pending,
      resolved,
      closed,
      unassigned,
    };
  }

  listStaff(): Promise<
    Array<{ id: string; email: string; displayName?: string }>
  > {
    return this.userModel
      .find({ roles: { $in: [...CHAT_STAFF_ROLES] } })
      .select('email profile.displayName roles')
      .limit(50)
      .lean()
      .exec()
      .then((users) =>
        users.map((u) => ({
          id: String(u._id),
          email: u.email,
          displayName: u.profile?.displayName,
        })),
      );
  }

  // --- Reads ---

  async list(
    user: AuthenticatedUser,
    query: QueryTicketsDto,
  ): Promise<PaginatedResult<TicketDocument>> {
    const filter: FilterQuery<TicketDocument> = {};
    if (isStaff(user)) {
      if (query.assignedToMe === 'true') {
        filter.assignedAdminId = new Types.ObjectId(user.id);
      }
    } else {
      filter.userId = new Types.ObjectId(user.id);
    }
    if (query.status) {
      filter.status = query.status;
    }

    const { page, limit } = query;
    const [items, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort({ lastReplyAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.ticketModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }

  getOne(
    user: AuthenticatedUser,
    ticketId: string,
  ): Promise<TicketDocument> {
    return this.getAccessible(user, ticketId);
  }

  async getMessages(
    user: AuthenticatedUser,
    ticketId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<TicketMessageDocument>> {
    await this.getAccessible(user, ticketId);
    const filter: FilterQuery<TicketMessageDocument> = {
      ticketId: new Types.ObjectId(ticketId),
    };
    if (!isStaff(user)) {
      filter.internal = false; // customers never see internal notes
    }
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }

  // --- Internals ---

  private async getAccessible(
    user: AuthenticatedUser,
    ticketId: string,
  ): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(ticketId).exec();
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (!isStaff(user) && String(ticket.userId) !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    return ticket;
  }

  private async notifyReply(
    ticket: TicketDocument,
    sender: AuthenticatedUser,
    staff: boolean,
  ): Promise<void> {
    if (staff) {
      await this.dispatcher.dispatch(
        NotificationEvent.TicketReply,
        ticket.userId,
        {
          ticketNumber: ticket.ticketNumber,
          ticketId: String(ticket._id),
          preview: 'Support has replied to your ticket.',
        },
      );
    } else if (ticket.assignedAdminId) {
      await this.dispatcher.dispatch(
        NotificationEvent.Custom,
        ticket.assignedAdminId,
        {
          title: `Customer reply on ticket ${ticket.ticketNumber}`,
          body: 'The customer has replied to an assigned ticket.',
          ticketId: String(ticket._id),
        },
        NotificationAudience.Staff,
      );
    }
  }

  private async generateTicketNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `TKT-${Date.now().toString(36).toUpperCase()}-${randomBytes(
        2,
      )
        .toString('hex')
        .toUpperCase()}`;
      const exists = await this.ticketModel.exists({ ticketNumber: candidate });
      if (!exists) {
        return candidate;
      }
    }
    throw new Error('Could not generate a unique ticket number');
  }
}
