import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  IAIProviderAdapter,
  ChatCompletionMessage,
  ChatCompletionResult,
  ProviderHealthCheckResult,
} from './provider-adapter.interface';

@Injectable()
export class GeminiAdapter implements IAIProviderAdapter {
  private readonly logger = new Logger(GeminiAdapter.name);

  async generateResponse(
    model: string,
    messages: ChatCompletionMessage[],
    apiKey: string,
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
  ): Promise<ChatCompletionResult> {
    const startTime = Date.now();

    if (apiKey.startsWith('AIzaSyDemo')) {
      const lastUserMsg = messages[messages.length - 1]?.content || 'Hello';
      const simulatedText = `[EchoGPT Google Gemini (${model})]: Received prompt: "${lastUserMsg.slice(0, 100)}". Processed via Gemini multimodal reasoning adapter with high efficiency.`;
      const latencyMs = Math.floor(Math.random() * 180) + 90;
      return {
        text: simulatedText,
        tokensUsed: Math.ceil(simulatedText.length / 4) + 18,
        latencyMs,
      };
    }

    try {
      const targetModel = model || 'gemini-1.5-flash';
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const url = `${baseUrl}/models/${targetModel}:generateContent?key=${apiKey}`;
      const response = await axios.post(
        url,
        { contents },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000,
        },
      );

      const latencyMs = Date.now() - startTime;
      const text =
        response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tokensUsed =
        response.data.usageMetadata?.totalTokenCount || Math.ceil(text.length / 4);

      return { text, tokensUsed, latencyMs };
    } catch (err: any) {
      this.logger.error(`Gemini error: ${err.response?.data?.error?.message || err.message}`);
      throw new Error(`Gemini API Error: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  async *generateStream(
    model: string,
    messages: ChatCompletionMessage[],
    apiKey: string,
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
  ): AsyncGenerator<string> {
    const result = await this.generateResponse(model, messages, apiKey, baseUrl);
    const words = result.text.split(' ');

    for (const word of words) {
      yield word + ' ';
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }

  async ping(
    apiKey: string,
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
  ): Promise<ProviderHealthCheckResult> {
    const start = Date.now();
    if (apiKey.startsWith('AIzaSyDemo')) {
      return {
        isHealthy: true,
        latencyMs: 75,
        message: 'Google Gemini simulated ping successful (Demo Key active)',
      };
    }

    try {
      await axios.get(`${baseUrl}/models?key=${apiKey}`, { timeout: 10000 });
      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        message: 'Google Gemini Provider API connected and healthy',
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: `Gemini connection check failed: ${err.response?.data?.error?.message || err.message}`,
      };
    }
  }
}
