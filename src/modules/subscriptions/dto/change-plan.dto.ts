import { IsEnum, IsNotEmpty } from 'class-validator';
import { PlanTier } from '@prisma/client';

export class ChangePlanDto {
  /**
   * Desired subscription plan tier
   * @example PREMIUM
   */
  @IsEnum(PlanTier, { message: 'Plan must be FREE, PREMIUM, or ENTERPRISE' })
  @IsNotEmpty()
  plan: PlanTier;
}
