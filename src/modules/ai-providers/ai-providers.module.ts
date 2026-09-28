import { Module } from '@nestjs/common';
import { AIProvidersService } from './ai-providers.service';
import { AIProvidersController } from './ai-providers.controller';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { AIProviderFactory } from './adapters/provider.factory';

@Module({
  controllers: [AIProvidersController],
  providers: [
    AIProvidersService,
    OpenAIAdapter,
    AnthropicAdapter,
    GeminiAdapter,
    AIProviderFactory,
  ],
  exports: [AIProvidersService, AIProviderFactory],
})
export class AIProvidersModule {}
