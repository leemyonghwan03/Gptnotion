namespace GptNotion.Contracts {
  export type SearchMode = 'fast' | 'deep';
  export type StorageMode = 'indexeddb' | 'localdb';
  export type BlockType =
    | 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'todo'
    | 'quote' | 'callout' | 'code' | 'divider' | 'table' | 'database' | 'image' | 'file';

  export interface PageModel {
    readonly id: string;
    title: string;
    icon: string;
    parentId: string | null;
    pinned: boolean;
    deleted: boolean;
    createdAt: number;
    updatedAt: number;
    accessedAt: number;
  }

  export interface BlockModel {
    readonly id: string;
    readonly pageId: string;
    type: BlockType | string;
    content: string;
    depth: number;
    order: number;
    properties: Readonly<Record<string, unknown>>;
    createdAt: number;
    updatedAt: number;
  }

  export interface DatabaseModel {
    readonly id: string;
    readonly pageId: string;
    name: string;
    createdAt: number;
    updatedAt: number;
  }

  export interface RagDocumentModel {
    readonly id: string;
    name: string;
    folderId: string | null;
    documentType?: string;
    authorityLevel?: number;
    updatedAt?: number;
  }

  export interface RagSearchRequest {
    readonly query: string;
    readonly limit: number;
    readonly searchMode: SearchMode;
    readonly documentIds?: readonly string[];
    readonly authorityAware?: boolean;
    readonly parentExpansion?: boolean;
  }

  export interface RagTiming {
    readonly total?: number;
    readonly fts?: number;
    readonly vector?: number;
    readonly exact?: number;
    readonly fusion?: number;
    readonly expand?: number;
  }

  export interface RagSearchItem {
    readonly documentId: string;
    readonly chunkId: string;
    readonly title: string;
    readonly headingPath?: string;
    readonly text: string;
    readonly anchorText?: string;
    readonly contextText?: string;
    readonly score?: number;
    readonly authorityLevel?: number;
  }

  export interface RagSearchResponse {
    readonly ok?: boolean;
    readonly items: readonly RagSearchItem[];
    readonly count?: number;
    readonly retrievalMethod?: string;
    readonly timingMs?: RagTiming;
  }

  export interface McpCallEnvelope {
    readonly name: string;
    readonly arguments: Readonly<Record<string, unknown>>;
  }

  export interface McpHealth {
    readonly ok: boolean;
    readonly mcp?: boolean;
    readonly version?: string;
    readonly ragVersion?: string;
    readonly error?: string;
  }
}
