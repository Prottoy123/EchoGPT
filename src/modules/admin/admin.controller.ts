import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin Panel & Telemetry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics/dashboard')
  @ApiOperation({ summary: '[Admin] Get platform dashboard analytics, usage stats, and AI health' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics returned' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: '[Admin] List users with pagination and search filter' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'john' })
  @ApiResponse({ status: 200, description: 'User list returned' })
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminService.listUsers(pageNum, limitNum, search);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: '[Admin] Update a user role (USER / ADMIN)' })
  @ApiResponse({ status: 200, description: 'User role updated' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto.role);
  }

  @Get('analytics/usage-logs')
  @ApiOperation({ summary: '[Admin] Query API request logs, status codes, and execution latencies' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'endpoint', required: false, example: '/api/v1/chat' })
  @ApiQuery({ name: 'statusCode', required: false, example: 200 })
  @ApiResponse({ status: 200, description: 'Usage logs returned' })
  async getApiUsageLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('endpoint') endpoint?: string,
    @Query('statusCode') statusCode?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const code = statusCode ? parseInt(statusCode, 10) : undefined;
    return this.adminService.getApiUsageLogs(pageNum, limitNum, endpoint, code);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: '[Admin] List all user subscriptions and quotas' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'User subscriptions returned' })
  async getUserSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminService.getUserSubscriptions(pageNum, limitNum);
  }
}
