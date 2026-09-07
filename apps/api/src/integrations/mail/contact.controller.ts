import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ContactInquiryService } from '../../modules/contact-inquiries/contact-inquiry.service';
import { ContactMessageDto } from './dto/contact-message.dto';
import { MailerService } from './mailer.service';

/** Public storefront contact form → inbox + operational email alert. */
@Controller('contact')
export class ContactController {
  constructor(
    private readonly mailer: MailerService,
    private readonly inquiries: ContactInquiryService,
  ) {}

  @Public()
  @Post()
  async submit(@Body() dto: ContactMessageDto): Promise<{ success: true }> {
    const payload = {
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      subject: dto.subject.trim(),
      message: dto.message.trim(),
    };

    await this.inquiries.createFromPublicForm(payload);

    void this.mailer
      .sendContactMessage({
        fromName: payload.name,
        fromEmail: payload.email,
        subject: payload.subject,
        message: payload.message,
      })
      .catch(() => undefined);

    return { success: true };
  }
}
