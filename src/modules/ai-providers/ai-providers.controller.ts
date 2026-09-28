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
@UseGuards(JwtAuthGuard)
@Controller()
export class AIProvidersController {
  constructor(private readonly aiProvidersService: AIProvidersService) {}

  @Get('ai-providers')
  @ApiOperation({ summary: 'List all active AI providers and supported models for Chrome Extension' })
  @ApiResponse({ status: 200, description: 'Enabled providers returned successfully' })
  async listActiveProviders() {
    return this.aiProvidersService.listActiveProviders();
  }

  @Get('admin/ai-providers')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] List all AI providers with masked API keys and telemetry' })
  @ApiResponse({ status: 200, description: 'All providers returned' })
  async listAllProvidersAdmin() {
    return this.aiProvidersService.listAllProvidersAdmin();
  }

  @Post('admin/ai-providers')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Register a new AI provider (API key encrypted via AES-256-GCM)' })
  @ApiResponse({ status: 201, description: 'Provider created successfully' })
  async createProvider(@Body() dto: CreateProviderDto) {
    return this.aiProvidersService.createProvider(dto);
  }

  @Patch('admin/ai-providers/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update provider credentials, models, or settings' })
  @ApiResponse({ status: 200, description: 'Provider updated' })
  async updateProvider(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
  ) {
    return this.aiProvidersService.updateProvider(id, dto);
  }

  @Delete('admin/ai-providers/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Remove an AI provider' })
  @ApiResponse({ status: 200, description: 'Provider removed' })
  async deleteProvider(@Param('id') id: string) {
    return this.aiProvidersService.deleteProvider(id);
  }

  @Patch('admin/ai-providers/:id/toggle')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Enable or disable an AI provider' })
  @ApiResponse({ status: 200, description: 'Provider status toggled' })
  async toggleProvider(@Param('id') id: string) {
    return this.aiProvidersService.toggleProvider(id);
  }

  @Patch('admin/ai-providers/:id/default')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Set an AI provider as system default' })
  @ApiResponse({ status: 200, description: 'Default provider updated' })
  async setDefaultProvider(@Param('id') id: string) {
    return this.aiProvidersService.setDefaultProvider(id);
  }

  @Get('admin/ai-providers/:id/health')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Health check ping testing provider API latency and credentials' })
  @ApiResponse({ status: 200, description: 'Health check result returned' })
  async checkHealth(@Param('id') id: string) {
    return this.aiProvidersService.checkHealth(id);
  }
}
