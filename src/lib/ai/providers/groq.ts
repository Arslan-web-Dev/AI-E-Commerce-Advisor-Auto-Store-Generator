import '../gateway/server-only';
import type { AIProvider, AIProviderResult, AIRequest } from '../gateway/types';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

type GroqCompletion = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export class GroqProviderError extends Error {
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
    this.name = 'GroqProviderError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function getGroqConfig() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const model = process.env.GROQ_MODEL?.trim();
  if (!apiKey || !model) {
    throw new GroqProviderError(
      'Groq provider requires GROQ_API_KEY and GROQ_MODEL.',
      'not_configured',
      false,
    );
  }
  return { apiKey, model };
}

export const groqProvider: AIProvider = {
  name: 'groq',

  async generate(request: AIRequest, signal: AbortSignal): Promise<AIProviderResult> {
    const { apiKey, model } = getGroqConfig();

    let response: Response;
    try {
      response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.prompt },
          ],
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          ...(request.maxOutputTokens === undefined ? {} : { max_tokens: request.maxOutputTokens }),
          stream: false,
          // No tools are supplied: provider requests cannot invoke external actions.
        }),
        signal,
        cache: 'no-store',
      });
    } catch (error) {
      // Preserve the gateway's abort reason so timeouts are logged as `timeout`.
      if (signal.aborted) throw error;
      throw new GroqProviderError('Groq network request failed.', 'server_error', true);
    }

    if (!response.ok) {
      const status = response.status;
      // Do not retain raw provider response bodies; they can contain request details.
      if (status === 429) {
        throw new GroqProviderError('Groq rate limit reached.', 'rate_limited', true, status);
      }
      if (status >= 500) {
        throw new GroqProviderError('Groq service returned an error.', 'server_error', true, status);
      }
      throw new GroqProviderError('Groq rejected the request.', 'request_rejected', false, status);
    }

    let completion: GroqCompletion;
    try {
      completion = (await response.json()) as GroqCompletion;
    } catch {
      throw new GroqProviderError('Groq returned an unreadable response.', 'invalid_response', true);
    }

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new GroqProviderError('Groq returned no text output.', 'invalid_response', true);
    }

    return {
      content,
      provider: 'groq',
      model: completion.model || model,
      usage: {
        ...(typeof completion.usage?.prompt_tokens === 'number'
          ? { inputTokens: completion.usage.prompt_tokens }
          : {}),
        ...(typeof completion.usage?.completion_tokens === 'number'
          ? { outputTokens: completion.usage.completion_tokens }
          : {}),
      },
    };
  },
};
