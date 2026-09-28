import { IsEnum, IsNotEmpty } from 'class-validator';
import { PlanType } from '@prisma/client';

export class UpdateUserSubscriptionDto {
  /**
   * New subscription plan
   * @example PREMIUM
   */
  @IsEnum(PlanType)
  @IsNotEmpty()
  planName: PlanType;
}
