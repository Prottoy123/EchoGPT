import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserSubscriptionDto } from './dto/update-user-subscription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin Panel')
@ApiBearerAuth('JWT')
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get aggregated platform statistics for Admin Dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics and counters' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access only' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination and usage details' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminService.listUsers(pageNum, limitNum);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change user role (ADMIN or USER)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User role updated' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto.role);
  }

  @Patch('users/:id/subscription')
  @ApiOperation({ summary: 'Assign or upgrade/downgrade a user subscription plan' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Subscription plan updated' })
  async updateUserSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateUserSubscriptionDto,
  ) {
    return this.adminService.updateUserSubscription(id, dto.planName);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user and cascade delete their data' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List subscription plans and subscriber distribution' })
  @ApiResponse({ status: 200, description: 'Subscription plan details' })
  async listSubscriptions() {
    return this.adminService.listSubscriptions();
  }

  @Get('analytics/usage')
  @ApiOperation({ summary: 'Get API usage analytics (requests, latency, status codes)' })
  @ApiResponse({ status: 200, description: 'Aggregated API analytics' })
  async getUsageAnalytics() {
    return this.adminService.getUsageAnalytics();
  }

  @Get('logs')
  @ApiOperation({ summary: 'View recent API request audit logs' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiResponse({ status: 200, description: 'Paginated API logs' })
  async getLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.adminService.getLogs(pageNum, limitNum);
  }

  @Get('system/health')
  @ApiOperation({ summary: 'System diagnostics and database health metrics' })
  @ApiResponse({ status: 200, description: 'System health report' })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }
}
