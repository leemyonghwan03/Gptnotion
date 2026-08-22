namespace GptNotion.Features.Rag {
  export interface RagServiceConfig {
    readonly defaultLimit: number;
    readonly defaultMode: GptNotion.Contracts.SearchMode;
  }

  export class RagSearchService {
    private config: RagServiceConfig;

    public constructor(config: RagServiceConfig) { this.config = config; }

    public configure(config: Partial<RagServiceConfig>): void {
      this.config = {
        defaultLimit: typeof config.defaultLimit === 'number' ? Math.max(1, Math.min(50, Math.trunc(config.defaultLimit))) : this.config.defaultLimit,
        defaultMode: config.defaultMode ?? this.config.defaultMode
      };
    }

    public async search(query: string, options: Partial<GptNotion.Contracts.RagSearchRequest> = {}): Promise<GptNotion.Contracts.RagSearchResponse> {
      const normalized = query.trim();
      if (!normalized) throw new GptNotion.Core.AppError('VALIDATION_ERROR', 'RAG 검색어는 비어 있을 수 없습니다.');
      const limit = typeof options.limit === 'number' ? Math.max(1, Math.min(50, Math.trunc(options.limit))) : this.config.defaultLimit;
      const searchMode = options.searchMode ?? this.config.defaultMode;
      const args: Record<string, unknown> = {
        query: normalized,
        limit,
        searchMode,
        authorityAware: options.authorityAware ?? true,
        parentExpansion: options.parentExpansion ?? true
      };
      if (options.documentIds) args.documentIds = Array.from(options.documentIds);
      if (searchMode === 'fast') {
        args.allowRemoteEmbedding = false;
        args.adaptiveRerank = false;
      }
      return GptNotion.Infrastructure.mcpClient.call('rag.hybrid_search', args, GptNotion.Contracts.parseRagSearchResponse);
    }

    public async status(): Promise<unknown> {
      return GptNotion.Infrastructure.mcpClient.callRaw('rag.large_status', {});
    }
  }

  export const searchService = new RagSearchService({ defaultLimit: 12, defaultMode: 'fast' });
}
