namespace GptNotion.Features.Ai {
  export type AiApiMode = 'chat' | 'responses';

  export interface AiEndpoint {
    readonly baseUrl: string;
    readonly mode: AiApiMode;
  }

  export function normalizeEndpoint(endpoint: AiEndpoint): string {
    const base = endpoint.baseUrl.trim().replace(/\/+$/, '');
    if (!base) throw new GptNotion.Core.AppError('VALIDATION_ERROR', 'AI Endpoint가 비어 있습니다.');
    if (endpoint.mode === 'chat') {
      if (/\/v1\/chat\/completions$/i.test(base)) return base;
      if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
      return `${base}/v1/chat/completions`;
    }
    if (/\/v1\/responses$/i.test(base)) return base;
    if (/\/v1$/i.test(base)) return `${base}/responses`;
    return `${base}/v1/responses`;
  }
}
