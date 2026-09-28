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
  @ApiOperation({ summary: '[Admin] Register or update an AI provider with encrypted key' })
  @ApiResponse({ status: 201, description: 'Provider saved with encrypted credentials' })
  async create(@Body() dto: CreateProviderDto) {
    return this.aiProvidersService.create(dto);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: '[Admin] Set an AI provider as global system default' })
  @ApiResponse({ status: 200, description: 'Default provider updated' })
  async setDefault(@Param('id') id: string) {
    return this.aiProvidersService.setDefault(id);
  }

  @Get()
  @ApiOperation({ summary: '[Admin] List all AI providers (keys are never exposed)' })
  @ApiResponse({ status: 200, description: 'List of configured providers' })
  async findAll() {
    return this.aiProvidersService.findAll();
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: '[Admin] Toggle provider active status' })
  @ApiResponse({ status: 200, description: 'Provider status updated' })
  async toggle(@Param('id') id: string) {
    return this.aiProvidersService.toggle(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[Admin] Update provider details or credentials' })
  @ApiResponse({ status: 200, description: 'Provider updated' })
  async update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.aiProvidersService.update(id, dto);
  }

  @Get(':id/health')
  @ApiOperation({ summary: '[Admin] Health check ping verifying provider key integrity and status' })
  @ApiResponse({ status: 200, description: 'Provider health check status' })
  async checkHealth(@Param('id') id: string) {
    return this.aiProvidersService.checkHealth(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Remove an AI provider' })
  @ApiResponse({ status: 200, description: 'Provider deleted' })
  async delete(@Param('id') id: string) {
    return this.aiProvidersService.delete(id);
  }
}
