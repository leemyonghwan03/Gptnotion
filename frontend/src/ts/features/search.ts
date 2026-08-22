namespace GptNotion.Features.Search {
  export interface SearchQuery {
    readonly text: string;
    readonly limit: number;
  }

  export function normalizeQuery(text: string, limit = 50): SearchQuery {
    return { text: text.trim(), limit: Math.max(1, Math.min(200, Math.trunc(limit))) };
  }
}
