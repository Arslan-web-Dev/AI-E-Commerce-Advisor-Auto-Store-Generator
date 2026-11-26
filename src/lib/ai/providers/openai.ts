import '../gateway/server-only';
import type { AIProvider, AIProviderResult, AIRequest } from '../gateway/types';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

type OpenAIResponse = {
  status?: string;
  model?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

export class OpenAIProviderError extends Error {
  readonly code: 'not_configured' | 'rate_limited' | 'server_error' | 'request_rejected' | 'invalid_response';
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    message: string,
    code: 'not_configured' | 'rate_limited' | 'server_error' | 'request_rejected' | 'invalid_response',
    retryable: boolean,
    status?: number,
  ) {
    super(message);
    this.name = 'OpenAIProviderError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  if (!apiKey || !model) {
    throw new OpenAIProviderError('OpenAI provider is not configured.', 'not_configured', false);
  }

  return { apiKey, model };
}

function extractOutputText(response: OpenAIResponse): string {
  return (response.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join('\n');
}

export const openAIProvider: AIProvider = {
  name: 'openai',

  async generate(request: AIRequest, signal: AbortSignal): Promise<AIProviderResult> {
    const { apiKey, model } = getOpenAIConfig();

    let response: Response;
    try {
      response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          instructions: request.systemPrompt,
          input: request.prompt,
          store: false,
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          ...(request.maxOutputTokens === undefined ? {} : { max_output_tokens: request.maxOutputTokens }),
          // No tools are supplied: provider requests cannot invoke external actions.
        }),
        signal,
        cache: 'no-store',
      });
    } catch (error) {
      // Preserve the gateway's abort reason so timeouts are logged as `timeout`.
      if (signal.aborted) throw error;
      throw new OpenAIProviderError('OpenAI network request failed.', 'server_error', true);
    }

    if (!response.ok) {
      const status = response.status;
      // Keep raw provider response bodies out of logs and user-facing errors.
      if (status === 429) {
        throw new OpenAIProviderError('OpenAI rate limit reached.', 'rate_limited', true, status);
      }
      if (status >= 500) {
        throw new OpenAIProviderError('OpenAI service returned an error.', 'server_error', true, status);
      }
      throw new OpenAIProviderError('OpenAI rejected the request.', 'request_rejected', false, status);
    }

    let result: OpenAIResponse;
    try {
      result = (await response.json()) as OpenAIResponse;
    } catch {
      throw new OpenAIProviderError('OpenAI returned an unreadable response.', 'invalid_response', true);
    }

    const content = extractOutputText(result);
    if (result.status !== 'completed' || !content) {
      throw new OpenAIProviderError('OpenAI returned no completed text output.', 'invalid_response', true);
    }

    return {
      content,
      provider: 'openai',
      model: result.model || model,
      usage: {
        ...(typeof result.usage?.input_tokens === 'number'
          ? { inputTokens: result.usage.input_tokens }
          : {}),
        ...(typeof result.usage?.output_tokens === 'number'
          ? { outputTokens: result.usage.output_tokens }
          : {}),
      },
    };
  },
};
