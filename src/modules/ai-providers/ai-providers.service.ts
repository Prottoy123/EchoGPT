import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { AIProviderFactory } from './adapters/provider.factory';
import { ProviderHealth } from '@prisma/client';

@Injectable()
export class AIProvidersService {
  private readonly logger = new Logger(AIProvidersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: AIProviderFactory,
  ) {}

  /**
   * Public list for Chrome Extension: returns only enabled providers and their available models
   */
  async listActiveProviders() {
    const providers = await this.prisma.aIProvider.findMany({
      where: { isEnabled: true },
      select: {
        id: true,
        providerType: true,
        displayName: true,
        baseUrl: true,
        defaultModels: true,
        isDefault: true,
        healthStatus: true,
        lastHealthCheck: true,
      },
      orderBy: [{ isDefault: 'desc' }, { displayName: 'asc' }],
    });

    return providers;
  }

  /**
   * Admin list: returns all providers with masked API keys
   */
  async listAllProvidersAdmin() {
    const providers = await this.prisma.aIProvider.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return providers.map((p) => {
      let maskedKey = '****';
      try {
        const decrypted = CryptoUtil.decrypt(p.encryptedApiKey, p.iv, p.authTag);
        maskedKey = decrypted.length > 8
          ? `${decrypted.slice(0, 4)}...${decrypted.slice(-4)}`
          : '****';
      } catch {
        maskedKey = '[Encryption Error]';
      }

      return {
        id: p.id,
        providerType: p.providerType,
        displayName: p.displayName,
        maskedApiKey: maskedKey,
        baseUrl: p.baseUrl,
        defaultModels: p.defaultModels,
        isEnabled: p.isEnabled,
        isDefault: p.isDefault,
        healthStatus: p.healthStatus,
        lastHealthCheck: p.lastHealthCheck,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });
  }

  async createProvider(dto: CreateProviderDto) {
    const encrypted = CryptoUtil.encrypt(dto.apiKey);

    if (dto.isDefault) {
      await this.prisma.aIProvider.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await this.prisma.aIProvider.create({
      data: {
        providerType: dto.providerType,
        displayName: dto.displayName,
        encryptedApiKey: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        baseUrl: dto.baseUrl,
        defaultModels: dto.defaultModels || [],
        isEnabled: true,
        isDefault: dto.isDefault || false,
        healthStatus: ProviderHealth.ONLINE,
      },
    });

    return {
      message: `AI Provider "${provider.displayName}" created successfully`,
      provider: {
        id: provider.id,
        providerType: provider.providerType,
        displayName: provider.displayName,
        baseUrl: provider.baseUrl,
        defaultModels: provider.defaultModels,
        isEnabled: provider.isEnabled,
        isDefault: provider.isDefault,
      },
    };
  }

  async updateProvider(id: string, dto: UpdateProviderDto) {
    const existing = await this.prisma.aIProvider.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`AI Provider with ID "${id}" not found`);
    }

    let encryptedData: { ciphertext?: string; iv?: string; authTag?: string } = {};
    if (dto.apiKey) {
      const encrypted = CryptoUtil.encrypt(dto.apiKey);
      encryptedData = {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      };
    }

    if (dto.isDefault) {
      await this.prisma.aIProvider.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.aIProvider.update({
      where: { id },
      data: {
        ...(dto.displayName && { displayName: dto.displayName }),
        ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
        ...(dto.defaultModels && { defaultModels: dto.defaultModels }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(encryptedData.ciphertext && {
          encryptedApiKey: encryptedData.ciphertext,
          iv: encryptedData.iv,
          authTag: encryptedData.authTag,
        }),
      },
    });

    return {
      message: `AI Provider "${updated.displayName}" updated successfully`,
      provider: {
        id: updated.id,
        providerType: updated.providerType,
        displayName: updated.displayName,
        baseUrl: updated.baseUrl,
        defaultModels: updated.defaultModels,
        isEnabled: updated.isEnabled,
        isDefault: updated.isDefault,
      },
    };
  }

  async deleteProvider(id: string) {
    const existing = await this.prisma.aIProvider.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`AI Provider with ID "${id}" not found`);
    }

    await this.prisma.aIProvider.delete({
      where: { id },
    });

    return { message: `AI Provider "${existing.displayName}" deleted successfully` };
  }

  async toggleProvider(id: string) {
    const existing = await this.prisma.aIProvider.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`AI Provider with ID "${id}" not found`);
    }

    const updated = await this.prisma.aIProvider.update({
      where: { id },
      data: { isEnabled: !existing.isEnabled },
    });

    return {
      message: `AI Provider is now ${updated.isEnabled ? 'enabled' : 'disabled'}`,
      isEnabled: updated.isEnabled,
    };
  }

  async setDefaultProvider(id: string) {
    const existing = await this.prisma.aIProvider.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`AI Provider with ID "${id}" not found`);
    }

    await this.prisma.aIProvider.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    const updated = await this.prisma.aIProvider.update({
      where: { id },
      data: { isDefault: true, isEnabled: true },
    });

    return {
      message: `"${updated.displayName}" set as default AI provider`,
      isDefault: updated.isDefault,
    };
  }

  async checkHealth(id: string) {
    const provider = await this.prisma.aIProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException(`AI Provider with ID "${id}" not found`);
    }

    const adapter = this.providerFactory.getAdapter(provider.providerType);
    let apiKey: string;
    try {
      apiKey = CryptoUtil.decrypt(provider.encryptedApiKey, provider.iv, provider.authTag);
    } catch {
      throw new BadRequestException('Failed to decrypt provider API key');
    }

    const pingResult = await adapter.ping(apiKey, provider.baseUrl || undefined);
    const healthStatus = pingResult.isHealthy ? ProviderHealth.ONLINE : ProviderHealth.OFFLINE;

    await this.prisma.aIProvider.update({
      where: { id },
      data: {
        healthStatus,
        lastHealthCheck: new Date(),
      },
    });

    return {
      providerId: provider.id,
      providerName: provider.displayName,
      providerType: provider.providerType,
      healthStatus,
      latencyMs: pingResult.latencyMs,
      details: pingResult.message,
      checkedAt: new Date(),
    };
  }

  /**
   * Internal helper: retrieves provider details and decrypted key
   */
  async getDecryptedProvider(providerId?: string) {
    let provider = null;

    if (providerId) {
      provider = await this.prisma.aIProvider.findFirst({
        where: { id: providerId, isEnabled: true },
      });
    }

    if (!provider) {
      provider = await this.prisma.aIProvider.findFirst({
        where: { isDefault: true, isEnabled: true },
      });
    }

    if (!provider) {
      provider = await this.prisma.aIProvider.findFirst({
        where: { isEnabled: true },
      });
    }

    if (!provider) {
      throw new NotFoundException('No active AI providers available in the system');
    }

    const apiKey = CryptoUtil.decrypt(
      provider.encryptedApiKey,
      provider.iv,
      provider.authTag,
    );

    return {
      provider,
      apiKey,
      adapter: this.providerFactory.getAdapter(provider.providerType),
    };
  }
}
