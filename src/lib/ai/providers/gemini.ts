import '../gateway/server-only';
import type { AIProvider, AIProviderResult, AIRequest } from '../gateway/types';

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

type GeminiInteraction = {
  status?: string;
  model?: string;
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
  };
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export class GeminiProviderError extends Error {
  constructor(
    message: string,
    readonly code: 'not_configured' | 'rate_limited' | 'server_error' | 'request_rejected' | 'invalid_response',
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiProviderError';
  }
}

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiProviderError('Gemini provider is not configured.', 'not_configured', false);
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
  };
}

function extractOutputText(interaction: GeminiInteraction): string {
  return (interaction.steps ?? [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join('\n');
}

export const geminiProvider: AIProvider = {
  name: 'gemini',

  async generate(request: AIRequest, signal: AbortSignal): Promise<AIProviderResult> {
    const { apiKey, model } = getGeminiConfig();

    let response: Response;
    try {
      response = await fetch(GEMINI_INTERACTIONS_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
          'api-revision': '2026-05-20',
        },
        body: JSON.stringify({
          model,
          input: request.prompt,
          system_instruction: request.systemPrompt,
          store: false,
          generation_config: {
            ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
            ...(request.maxOutputTokens === undefined ? {} : { max_output_tokens: request.maxOutputTokens }),
          },
        }),
        signal,
        cache: 'no-store',
      });
    } catch (error) {
      if (error instanceof GeminiProviderError) throw error;
      if (signal.aborted) {
        throw new GeminiProviderError('Gemini request timed out or was cancelled.', 'server_error', true);
      }
      throw new GeminiProviderError('Gemini network request failed.', 'server_error', true);
    }

    if (!response.ok) {
      const status = response.status;
      // Do not retain provider response bodies: they may contain sensitive request details.
      if (status === 429) {
        throw new GeminiProviderError('Gemini rate limit reached.', 'rate_limited', true, status);
      }
      if (status >= 500) {
        throw new GeminiProviderError('Gemini service returned an error.', 'server_error', true, status);
      }
      throw new GeminiProviderError('Gemini rejected the request.', 'request_rejected', false, status);
    }

    let interaction: GeminiInteraction;
    try {
      interaction = (await response.json()) as GeminiInteraction;
    } catch {
      throw new GeminiProviderError('Gemini returned an unreadable response.', 'invalid_response', true);
    }

    const content = extractOutputText(interaction);
    if (interaction.status !== 'completed' || !content) {
      throw new GeminiProviderError('Gemini returned no completed text output.', 'invalid_response', true);
    }

    return {
      content,
      provider: 'gemini',
      model: interaction.model || model,
      usage: {
        ...(typeof interaction.usage?.total_input_tokens === 'number'
          ? { inputTokens: interaction.usage.total_input_tokens }
          : {}),
        ...(typeof interaction.usage?.total_output_tokens === 'number'
          ? { outputTokens: interaction.usage.total_output_tokens }
          : {}),
      },
    };
  },
};
