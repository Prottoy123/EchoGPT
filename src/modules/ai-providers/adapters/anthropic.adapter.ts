import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  IAIProviderAdapter,
  ChatCompletionMessage,
  ChatCompletionResult,
  ProviderHealthCheckResult,
} from './provider-adapter.interface';

@Injectable()
export class AnthropicAdapter implements IAIProviderAdapter {
  private readonly logger = new Logger(AnthropicAdapter.name);

  async generateResponse(
    model: string,
    messages: ChatCompletionMessage[],
    apiKey: string,
    baseUrl = 'https://api.anthropic.com/v1',
  ): Promise<ChatCompletionResult> {
    const startTime = Date.now();

    if (apiKey.startsWith('sk-ant-demo')) {
      const lastUserMsg = messages[messages.length - 1]?.content || 'Hello';
      const simulatedText = `[EchoGPT Claude (${model})]: I understand your request regarding: "${lastUserMsg.slice(0, 100)}". Generated via Anthropic Claude adapter with high precision reasoning.`;
      const latencyMs = Math.floor(Math.random() * 250) + 120;
      return {
        text: simulatedText,
        tokensUsed: Math.ceil(simulatedText.length / 4) + 20,
        latencyMs,
      };
    }

    try {
      const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
      const conversationMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      const response = await axios.post(
        `${baseUrl}/messages`,
        {
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: conversationMessages,
          ...(systemMsg && { system: systemMsg }),
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        },
      );

      const latencyMs = Date.now() - startTime;
      const text = response.data.content?.[0]?.text || '';
      const tokensUsed =
        (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0);

      return { text, tokensUsed, latencyMs };
    } catch (err: any) {
      this.logger.error(`Claude error: ${err.response?.data?.error?.message || err.message}`);
      throw new Error(`Claude API Error: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  async *generateStream(
    model: string,
    messages: ChatCompletionMessage[],
    apiKey: string,
    baseUrl = 'https://api.anthropic.com/v1',
  ): AsyncGenerator<string> {
    const result = await this.generateResponse(model, messages, apiKey, baseUrl);
    const words = result.text.split(' ');

    for (const word of words) {
      yield word + ' ';
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }

  async ping(apiKey: string, baseUrl = 'https://api.anthropic.com/v1'): Promise<ProviderHealthCheckResult> {
    const start = Date.now();
    if (apiKey.startsWith('sk-ant-demo')) {
      return {
        isHealthy: true,
        latencyMs: 95,
        message: 'Anthropic Claude simulated ping successful (Demo Key active)',
      };
    }

    try {
      // Test ping with tiny message
      await axios.post(
        `${baseUrl}/messages`,
        {
          model: 'claude-3-haiku-20240307',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        message: 'Anthropic Claude Provider API connected and healthy',
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: `Claude connection check failed: ${err.response?.data?.error?.message || err.message}`,
      };
    }
  }
}
