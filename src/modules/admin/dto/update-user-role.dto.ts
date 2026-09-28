import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  /**
   * New role to assign
   * @example ADMIN
   */
  @IsEnum(Role, { message: 'Role must be USER or ADMIN' })
  @IsNotEmpty()
  role: Role;
}
