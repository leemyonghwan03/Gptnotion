namespace GptNotion.Contracts {
  function record(value: unknown): Record<string, unknown> | null {
    return GptNotion.Core.isRecord(value) ? value : null;
  }

  export function parseMcpHealth(value: unknown): McpHealth {
    const row = record(value);
    if (!row || typeof row.ok !== 'boolean') {
      throw new GptNotion.Core.AppError('CONTRACT_ERROR', 'MCP health 응답 형식이 올바르지 않습니다.');
    }
    return {
      ok: row.ok,
      mcp: typeof row.mcp === 'boolean' ? row.mcp : undefined,
      version: typeof row.version === 'string' ? row.version : undefined,
      ragVersion: typeof row.ragVersion === 'string' ? row.ragVersion : undefined,
      error: typeof row.error === 'string' ? row.error : undefined
    };
  }

  export function parseRagSearchResponse(value: unknown): RagSearchResponse {
    const row = record(value);
    if (!row || !Array.isArray(row.items)) {
      throw new GptNotion.Core.AppError('CONTRACT_ERROR', 'RAG 검색 응답에 items 배열이 없습니다.');
    }
    const items: RagSearchItem[] = [];
    for (const raw of row.items) {
      const item = record(raw);
      if (!item) continue;
      const documentId = GptNotion.Core.asNonEmptyString(item.documentId);
      const chunkId = GptNotion.Core.asNonEmptyString(item.chunkId) ?? GptNotion.Core.asNonEmptyString(item.id);
      const title = typeof item.title === 'string' ? item.title : '';
      const text = typeof item.text === 'string' ? item.text : (typeof item.contextText === 'string' ? item.contextText : '');
      if (!documentId || !chunkId) continue;
      items.push({
        documentId, chunkId, title, text,
        headingPath: typeof item.headingPath === 'string' ? item.headingPath : undefined,
        anchorText: typeof item.anchorText === 'string' ? item.anchorText : undefined,
        contextText: typeof item.contextText === 'string' ? item.contextText : undefined,
        score: typeof item.score === 'number' ? item.score : undefined,
        authorityLevel: typeof item.authorityLevel === 'number' ? item.authorityLevel : undefined
      });
    }
    const timingRaw = record(row.timingMs);
    const timingMs: RagTiming | undefined = timingRaw ? {
      total: GptNotion.Core.asFiniteNumber(timingRaw.total) ?? undefined,
      fts: GptNotion.Core.asFiniteNumber(timingRaw.fts) ?? undefined,
      vector: GptNotion.Core.asFiniteNumber(timingRaw.vector) ?? undefined,
      exact: GptNotion.Core.asFiniteNumber(timingRaw.exact) ?? undefined,
      fusion: GptNotion.Core.asFiniteNumber(timingRaw.fusion) ?? undefined,
      expand: GptNotion.Core.asFiniteNumber(timingRaw.expand) ?? undefined
    } : undefined;
    return {
      ok: typeof row.ok === 'boolean' ? row.ok : undefined,
      items,
      count: typeof row.count === 'number' ? row.count : items.length,
      retrievalMethod: typeof row.retrievalMethod === 'string' ? row.retrievalMethod : undefined,
      timingMs
    };
  }
}
