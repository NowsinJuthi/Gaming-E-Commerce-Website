import { IsIn, IsString } from 'class-validator';
import { BILLING_CYCLES, BillingCycle } from '../media-subscription.types';

export class StartMediaSubscriptionDto {
  @IsString()
  planSlug!: string;

  @IsIn([...BILLING_CYCLES])
  billingCycle!: BillingCycle;
}

export class ChangeMediaSubscriptionDto {
  @IsString()
  planSlug!: string;

  @IsIn([...BILLING_CYCLES])
  billingCycle!: BillingCycle;
}
