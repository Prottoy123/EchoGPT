import { Injectable, BadRequestException } from '@nestjs/common';
import { AIProviderType } from '@prisma/client';
import { OpenAIAdapter } from './openai.adapter';
import { AnthropicAdapter } from './anthropic.adapter';
import { GeminiAdapter } from './gemini.adapter';
import { IAIProviderAdapter } from './provider-adapter.interface';

@Injectable()
export class AIProviderFactory {
  constructor(
    private readonly openAiAdapter: OpenAIAdapter,
    private readonly anthropicAdapter: AnthropicAdapter,
    private readonly geminiAdapter: GeminiAdapter,
  ) {}

  getAdapter(providerType: AIProviderType): IAIProviderAdapter {
    switch (providerType) {
      case AIProviderType.OPENAI:
        return this.openAiAdapter;
      case AIProviderType.ANTHROPIC:
        return this.anthropicAdapter;
      case AIProviderType.GEMINI:
        return this.geminiAdapter;
      default:
        throw new BadRequestException(`Unsupported AI Provider Type: ${providerType}`);
    }
  }
}
