import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  /**
   * New user role
   * @example ADMIN
   */
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
