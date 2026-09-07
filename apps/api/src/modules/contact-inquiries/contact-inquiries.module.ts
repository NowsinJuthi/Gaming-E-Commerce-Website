import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ContactInquiry,
  ContactInquirySchema,
} from '../../database/schemas/contact-inquiry.schema';
import { ContactInquiryController } from './contact-inquiry.controller';
import { ContactInquiryService } from './contact-inquiry.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactInquiry.name, schema: ContactInquirySchema },
    ]),
  ],
  controllers: [ContactInquiryController],
  providers: [ContactInquiryService],
  exports: [ContactInquiryService],
})
export class ContactInquiriesModule {}
