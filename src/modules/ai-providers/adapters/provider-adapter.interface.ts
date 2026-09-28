export interface ChatCompletionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionResult {
  text: string;
  tokensUsed: number;
  latencyMs: number;
}

export interface ProviderHealthCheckResult {
  isHealthy: boolean;
  latencyMs: number;
  message: string;
}

export interface IAIProviderAdapter {
  generateResponse(
    model: string,
    messages: ChatCompletionMessage[],
    apiKey: string,
    baseUrl?: string,
  ): Promise<ChatCompletionResult>;

  generateStream(
    model: string,
    messages: ChatCompletionMessage[],
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<string>;

  ping(apiKey: string, baseUrl?: string): Promise<ProviderHealthCheckResult>;
}
