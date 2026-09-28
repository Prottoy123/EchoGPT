import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  IAIProviderAdapter,
  ChatCompletionMessage,
  ChatCompletionResult,
  ProviderHealthCheckResult,
} from './provider-adapter.interface';

@Injectable()
export class OpenAIAdapter implements IAIProviderAdapter {
  private readonly logger = new Logger(OpenAIAdapter.name);

  async generateResponse(
    model: string,
    messages: ChatCompletionMessage[],
    apiKey: string,
    baseUrl = 'https://api.openai.com/v1',
  ): Promise<ChatCompletionResult> {
    const startTime = Date.now();

    // If key is a demo/test key, generate realistic intelligent simulated response
    if (apiKey.startsWith('sk-demo')) {
      const lastUserMsg = messages[messages.length - 1]?.content || 'Hello';
      const simulatedText = `[EchoGPT OpenAI (${model})]: I have processed your prompt: "${lastUserMsg.slice(0, 100)}". This response was routed through the OpenAI Adapter with low latency and contextual understanding.`;
      const latencyMs = Math.floor(Math.random() * 200) + 100;
      return {
        text: simulatedText,
        tokensUsed: Math.ceil(simulatedText.length / 4) + 15,
        latencyMs,
      };
    }

    try {
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: model || 'gpt-4o',
          messages,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        },
      );

      const latencyMs = Date.now() - startTime;
      const text = response.data.choices[0]?.message?.content || '';
      const tokensUsed = response.data.usage?.total_tokens || Math.ceil(text.length / 4);

      return { text, tokensUsed, latencyMs };
    } catch (err: any) {
      this.logger.error(`OpenAI error: ${err.response?.data?.error?.message || err.message}`);
      throw new Error(`OpenAI API Error: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  async *generateStream(
    model: string,
    messages: ChatCompletionMessage[],
    apiKey: string,
    baseUrl = 'https://api.openai.com/v1',
  ): AsyncGenerator<string> {
    const result = await this.generateResponse(model, messages, apiKey, baseUrl);
    const words = result.text.split(' ');

    for (const word of words) {
      yield word + ' ';
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }

  async ping(apiKey: string, baseUrl = 'https://api.openai.com/v1'): Promise<ProviderHealthCheckResult> {
    const start = Date.now();
    if (apiKey.startsWith('sk-demo')) {
      return {
        isHealthy: true,
        latencyMs: 85,
        message: 'OpenAI Provider simulated ping successful (Demo Key active)',
      };
    }

    try {
      await axios.get(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        message: 'OpenAI Provider API connected and healthy',
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: `OpenAI connection failed: ${err.response?.data?.error?.message || err.message}`,
      };
    }
  }
}
