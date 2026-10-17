import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  BILLING_CYCLES,
  BillingCycle,
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
} from '../media-subscription.types';

export class AdminGrantMediaSubscriptionDto {
  @IsMongoId()
  userId!: string;

  @IsString()
  planSlug!: string;

  @IsIn([...BILLING_CYCLES])
  billingCycle!: BillingCycle;

  @IsOptional()
  @IsIn([...SUBSCRIPTION_STATUSES])
  status?: SubscriptionStatus;
}

export class AdminPatchMediaSubscriptionDto {
  @IsOptional()
  @IsIn([...SUBSCRIPTION_STATUSES])
  status?: SubscriptionStatus;

  @IsOptional()
  @IsISO8601()
  currentPeriodEnd?: string;

  @IsOptional()
  @IsISO8601()
  trialEnd?: string;

  @IsOptional()
  @IsISO8601()
  gracePeriodEndsAt?: string;

  @IsOptional()
  @IsISO8601()
  scheduledChangeAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

export class AdminActivateMediaPaymentDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  externalRef?: string;
}

export class AdminSuspendMediaSubscriptionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
