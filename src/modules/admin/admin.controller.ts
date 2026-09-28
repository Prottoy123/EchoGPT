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
  @ApiOperation({
    summary: 'Get aggregated platform statistics for Admin Dashboard',
    description: `
### Service Architecture & Aggregation Pipeline
- **Parallel Relational Aggregations**: Executes concurrent \`Promise.all\` queries across PostgreSQL models: \`User\`, \`Subscription\`, \`Conversation\`, \`Message\`, \`WebSearch\`, and \`ApiUsageLog\`.
- **Metrics Computed**:
  - Total registered users and role breakdown (Admin vs Regular users).
  - Subscription tier distribution (\`FREE\`, \`PRO\`, \`ENTERPRISE\`).
  - Active users within the last 24 hours (based on recent session activity).
  - Total conversation threads and total dispatched AI prompts.
  - Overall API request throughput and average platform latency.

### Future Scalability Roadmap
- **Materialized Views & Redis Cache**: As user counts scale past 100k+, replace live \`COUNT(*)\` queries with PostgreSQL Materialized Views or incremental Redis counters updated via event streams. Cache the aggregated response in Redis with a 60-second TTL.
    `,
  })
  @ApiResponse({ status: 200, description: 'Aggregated platform metrics and KPI counters' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires administrative privilege (Role.ADMIN)' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({
    summary: 'List all users with pagination and usage details',
    description: `
### Query Design & Data Projection
- **Relational Joins**: Eagerly includes user subscription status, plan tier, total conversation count, and usage counters in a single optimized SQL query.
- **Safety**: Password hashes and refresh token hashes are strictly omitted from the returned entity.
- **Pagination Strategy**: Standard offset-limit pagination with total item count and page calculation.
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Page size (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Paginated user catalog' })
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminService.listUsers(pageNum, limitNum);
  }

  @Patch('users/:id/role')
  @ApiOperation({
    summary: 'Change user role (ADMIN or USER)',
    description: `
### Role-Based Access Control (RBAC) Governance
- **Privilege Elevation/Revocation**: Allows system administrators to grant or revoke administrative capabilities (\`Role.ADMIN\` vs \`Role.USER\`).
- **Audit Logging**: Role transitions are recorded in the security audit trail to maintain compliance.
- **Self-Demotion Guard**: Protects against accidental lock-out by preventing the last active administrator from revoking their own administrative rights.
    `,
  })
  @ApiParam({ name: 'id', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'User role successfully updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto.role);
  }

  @Patch('users/:id/subscription')
  @ApiOperation({
    summary: 'Assign or upgrade/downgrade a user subscription plan',
    description: `
### Subscription Quota Mutation
- **Plan Realignment**: Administratively overrides a user's subscription tier (\`FREE\`, \`PRO\`, \`ENTERPRISE\`).
- **Quota Recalculation**: Dynamically adjusts \`requestLimit\` (e.g. 50/day for Free, 1000/day for Pro, Unlimited for Enterprise) and updates the reset window timestamp.
    `,
  })
  @ApiParam({ name: 'id', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'Subscription tier successfully updated' })
  @ApiResponse({ status: 404, description: 'User or plan not found' })
  async updateUserSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateUserSubscriptionDto,
  ) {
    return this.adminService.updateUserSubscription(id, dto.planName);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a user and cascade delete their data',
    description: `
### Cascade Lifecycle & Compliance (GDPR)
- **Complete Right to Erasure**: Deletes user account and cascades deletions to all associated data: sessions, refresh token entries, subscription records, conversations, message history, web search queries, and usage logs.
- **Administrative Constraint**: Prevents deletion of the primary platform administrator.
    `,
  })
  @ApiParam({ name: 'id', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'User and all related records deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('subscriptions')
  @ApiOperation({
    summary: 'List subscription plans and subscriber distribution',
    description: `
### Revenue & Tier Analytics
- **Tier Aggregation**: Returns plan configuration metadata (quotas, model access, rate limits) paired with live subscriber counts per tier.
- **Business Insights**: Enables tracking plan adoption rates and subscription churn metrics.
    `,
  })
  @ApiResponse({ status: 200, description: 'Subscription plans and distribution metrics' })
  async listSubscriptions() {
    return this.adminService.listSubscriptions();
  }

  @Get('analytics/usage')
  @ApiOperation({
    summary: 'Get API usage analytics (requests, latency, status codes)',
    description: `
### Telemetry & Observability Pipeline
- **Statistical Analysis**: Aggregates entries from \`ApiUsageLog\` over rolling 24-hour and 7-day windows.
- **Key Performance Indicators**:
  - Request volume by HTTP method and endpoint.
  - HTTP Status Code distribution (2xx success rate vs 4xx validation errors vs 5xx server exceptions).
  - P50, P90, and P99 latency percentiles to identify performance bottlenecks.

### Future Scalability Roadmap
- **Time-Series Metric Ingestion**: Forward telemetry events to Prometheus / Grafana or OpenTelemetry collectors for real-time time-series graphing, alerting thresholds, and distributed tracing.
    `,
  })
  @ApiResponse({ status: 200, description: 'Aggregated API analytics report' })
  async getUsageAnalytics() {
    return this.adminService.getUsageAnalytics();
  }

  @Get('logs')
  @ApiOperation({
    summary: 'View recent API request audit logs',
    description: `
### Security Audit & Compliance Log
- **Detailed Request Trail**: Inspects recorded HTTP requests including user ID, IP address, user agent, endpoint path, HTTP method, status code, and execution time in milliseconds.
- **Threat Detection**: Facilitates security audits, credential abuse detection, and forensic analysis during incident investigations.
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, example: 50, description: 'Log count per page (default: 50, max: 200)' })
  @ApiResponse({ status: 200, description: 'Paginated API audit logs' })
  async getLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.adminService.getLogs(pageNum, limitNum);
  }

  @Get('system/health')
  @ApiOperation({
    summary: 'System diagnostics and database health metrics',
    description: `
### Deep System Diagnostics
- **Infrastructure Health Check**:
  - PostgreSQL database connection pool status and ping latency.
  - Node.js runtime process metrics: RSS memory, Heap Used vs Heap Total, Uptime.
  - Event loop lag and CPU utilization metrics.
- **High Availability**: Acts as a comprehensive probe target for Kubernetes liveness/readiness probes or AWS ALB health checks.
    `,
  })
  @ApiResponse({ status: 200, description: 'Complete system diagnostics report' })
  @ApiResponse({ status: 503, description: 'Service Unavailable - Core dependency (e.g. PostgreSQL) offline' })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }
}
