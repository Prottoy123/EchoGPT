import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AIProvidersService } from './ai-providers.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('AI Provider Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('ai-providers')
export class AIProvidersController {
  constructor(private readonly aiProvidersService: AIProvidersService) {}

  @Post()
  @ApiOperation({
    summary: '[Admin] Register or update an AI provider with encrypted key',
    description: `
### Service Architecture & Security
- **AES-256-GCM Key Vaulting**: Protects sensitive upstream credentials (OpenAI, Anthropic, Google Gemini API keys). The incoming raw key is encrypted into an authenticated envelope format: \`iv:authTag:ciphertext\` using a 12-byte cryptographically secure initialization vector (IV) and producing a 16-byte authentication tag.
- **Data Protection**: Raw API keys are never stored in plaintext in PostgreSQL nor exposed in application crash logs or ORM queries.
- **Default Switch Policy**: If \`isDefault\` is set to true, an atomic transaction updates all other active providers to non-default, guaranteeing exactly one single active default AI engine across the cluster.

### Database Mutations
- Writes or updates records in the \`Provider\` table.
- Encrypts \`apiKey\` using the cluster-wide master \`ENCRYPTION_KEY\`.

### Future Scalability Roadmap
- **Hardware Security Modules (HSM / KMS)**: Transition from symmetric local node master key to envelope encryption via AWS KMS or HashiCorp Vault with automated 90-day key rotation without database migration downtime.
- **Dynamic Quota & Rate Limiting**: Introduce per-provider concurrency throttling and token-bucket rate limiting to prevent upstream HTTP 429 errors during sudden viral traffic surges.
    `,
  })
  @ApiResponse({ status: 201, description: 'Provider successfully registered with encrypted key envelope' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation failure or missing required provider fields' })
  @ApiResponse({ status: 403, description: 'Forbidden - Administrative privileges required' })
  async create(@Body() dto: CreateProviderDto) {
    return this.aiProvidersService.create(dto);
  }

  @Patch(':id/default')
  @ApiOperation({
    summary: '[Admin] Set an AI provider as global system default',
    description: `
### Service Architecture & Concurrency
- **Atomic Default Reassignment**: Executes an isolated Prisma \`$transaction\` that sets \`isDefault = false\` for all providers and \`isDefault = true\` on the selected record.
- **Fallback Guarantee**: Ensures the chat subsystem always has an unambiguous primary upstream route when a user initiates a conversation without specifying a custom model override.

### Future Scalability Roadmap
- **Distributed Cache Invalidation**: Publish a Redis pub/sub invalidation event (\`cache:provider:default\`) to purge stale cached provider instances across all running NestJS horizontal pod replicas instantly.
    `,
  })
  @ApiResponse({ status: 200, description: 'Default AI provider switched successfully' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async setDefault(@Param('id') id: string) {
    return this.aiProvidersService.setDefault(id);
  }

  @Get()
  @ApiOperation({
    summary: '[Admin] List all AI providers (keys are never exposed)',
    description: `
### Security & Zero-Leakage Policy
- **Credential Masking**: Strict projection sanitization ensures \`apiKey\` is never returned in HTTP responses. Instead, the endpoint exposes safe operational metadata: \`id\`, \`name\`, \`model\`, \`baseUrl\`, \`isDefault\`, \`isActive\`, and a boolean indicator \`hasKey: true/false\`.
- **Administrative Observability**: Enables administrators to review configured models and backend endpoints without exposing sensitive secrets in browser network panels.

### Future Scalability Roadmap
- **Read-Replica Routing**: Offload provider configuration queries to read-replicas or an in-memory cache layer with TTL, eliminating unnecessary database I/O for frequent read operations.
    `,
  })
  @ApiResponse({ status: 200, description: 'List of configured providers with sanitized metadata' })
  async findAll() {
    return this.aiProvidersService.findAll();
  }

  @Patch(':id/toggle')
  @ApiOperation({
    summary: '[Admin] Toggle provider active status',
    description: `
### Operational Governance
- **Circuit Breaker / Maintenance**: Allows operations teams to immediately take an unstable or rate-limited upstream provider offline without deleting configuration or losing connection parameters.
- **Default Integrity**: Enforces business logic preventing deactivation of the active default provider unless another default is designated first.
    `,
  })
  @ApiResponse({ status: 200, description: 'Provider active status toggled' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate the sole default provider' })
  async toggle(@Param('id') id: string) {
    return this.aiProvidersService.toggle(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '[Admin] Update provider details or credentials',
    description: `
### Service Architecture
- **Selective Ciphertext Re-encryption**: If a new raw API key is provided, the service re-encrypts the secret using AES-256-GCM with a newly generated IV, replacing the previous ciphertext envelope.
- **Partial Updates**: Supports updating model identifiers, custom base URLs (for Ollama, vLLM, or self-hosted proxy endpoints), and configuration parameters without disrupting active traffic.
    `,
  })
  @ApiResponse({ status: 200, description: 'Provider updated successfully' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.aiProvidersService.update(id, dto);
  }

  @Get(':id/health')
  @ApiOperation({
    summary: '[Admin] Health check ping verifying provider key integrity and status',
    description: `
### Diagnostic Probing Architecture
- **In-Memory Cryptographic Verification**: Verifies that the stored \`apiKey\` ciphertext can be decrypted in-memory using the active master key and that the authentication tag validates successfully.
- **Upstream Liveness Verification**: Dispatches a lightweight model listing or ping request to the upstream API (OpenAI, Anthropic, or Google Gemini) to confirm credential validity and measure real-time response latency.
- **Zero-Logging**: Raw credentials used during the ping are scrubbed immediately from execution memory and never written to diagnostic log files.

### Future Scalability Roadmap
- **Automated Health Probing (Cron Daemon)**: Periodically execute automated background health probes across all active providers, automatically flipping broken providers to inactive and alerting via webhook (Slack/PagerDuty).
    `,
  })
  @ApiResponse({ status: 200, description: 'Provider health check diagnostics report' })
  @ApiResponse({ status: 502, description: 'Bad Gateway - Upstream AI provider authentication failure or network timeout' })
  async checkHealth(@Param('id') id: string) {
    return this.aiProvidersService.checkHealth(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Remove an AI provider',
    description: `
### Deletion Governance
- **Safe Teardown**: Removes the provider record from PostgreSQL.
- **Guard Validation**: Rejects deletion if the provider is currently set as the system default, ensuring conversational fallback routes remain functional for all users.
    `,
  })
  @ApiResponse({ status: 200, description: 'Provider removed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete the current default provider' })
  async delete(@Param('id') id: string) {
    return this.aiProvidersService.delete(id);
  }
}
