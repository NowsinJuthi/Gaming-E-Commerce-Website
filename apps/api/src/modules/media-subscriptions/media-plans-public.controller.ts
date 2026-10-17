import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { MediaPlansService } from './media-plans.service';

@Controller('media/plans')
export class MediaPlansPublicController {
  constructor(private readonly plans: MediaPlansService) {}

  @Public()
  @Get()
  async list() {
    const plans = await this.plans.listActive();
    return { plans: plans.map((plan) => this.plans.toPublic(plan)) };
  }
}
