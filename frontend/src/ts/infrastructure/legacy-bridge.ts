interface Window {
  __GPT_LEGACY__?: GptNotion.Infrastructure.LegacyRuntimeBridge;
  GptNotionModular?: GptNotion.App.PublicApi;
}

namespace GptNotion.Infrastructure {
  export interface LegacyLinkModel {
    readonly id: string;
    readonly sourcePageId: string;
    readonly sourceBlockId: string;
    readonly targetPageId: string;
    readonly type: string;
    readonly createdAt: number;
  }

  export interface LegacyCachePort {
    pages: GptNotion.Contracts.PageModel[];
    blocks: GptNotion.Contracts.BlockModel[];
    links: LegacyLinkModel[];
  }

  export interface LegacyCacheIndexPort {
    addPage(page: GptNotion.Contracts.PageModel): void;
    updatePage(page: GptNotion.Contracts.PageModel, oldParentId?: string | null): void;
    addBlock(block: GptNotion.Contracts.BlockModel): void;
    updateBlock(block: GptNotion.Contracts.BlockModel, oldPageId?: string, oldOrder?: number): void;
    removeBlock(block: GptNotion.Contracts.BlockModel): void;
    addLink(link: LegacyLinkModel): void;
    removeLink(link: LegacyLinkModel): void;
    rebuildLinks(): void;
  }

  export interface LegacyDbManagerPort {
    rawIDBGetAll<TValue>(store: string): Promise<readonly TValue[]>;
    rawIDBGet<TValue>(store: string, id: string): Promise<TValue | null>;
    rawIDBPut<TValue extends object>(store: string, value: TValue): Promise<TValue>;
    rawIDBDelete(store: string, id: string): Promise<boolean>;
    rawIDBMultiPut<TValue extends object>(store: string, values: readonly TValue[]): Promise<boolean>;
    rawIDBAtomicBatch(payload: {
      readonly puts?: Readonly<Record<string, readonly object[]>>;
      readonly deletes?: Readonly<Record<string, readonly string[]>>;
    }): Promise<unknown>;
  }

  export interface LegacyPageStorePort {
    create(command: { readonly title: string; readonly parentId: string | null; readonly icon: string }): Promise<GptNotion.Contracts.PageModel>;
    get(id: string): GptNotion.Contracts.PageModel | null;
    getAll(): GptNotion.Contracts.PageModel[];
    update(id: string, patch: Partial<GptNotion.Contracts.PageModel>): Promise<GptNotion.Contracts.PageModel | null>;
  }

  export interface LegacyBlockStorePort {
    create(command: {
      readonly pageId: string;
      readonly type: string;
      readonly content: string;
      readonly depth: number;
      readonly order: number;
      readonly properties?: Readonly<Record<string, unknown>>;
    }): Promise<GptNotion.Contracts.BlockModel>;
    get(id: string): GptNotion.Contracts.BlockModel | null;
    getByPage(pageId: string): GptNotion.Contracts.BlockModel[];
    update(id: string, patch: Partial<GptNotion.Contracts.BlockModel>): Promise<GptNotion.Contracts.BlockModel | null>;
    delete(id: string): Promise<void>;
  }

  export interface LegacyLinkStorePort {
    getBySourceBlock(blockId: string): LegacyLinkModel[];
  }

  export interface LegacyStorageConfigPort {
    isLocal(): boolean;
  }

  export interface LegacyUndoManagerPort {
    pushUndo(pageId: string): void;
    undo(pageId: string): Promise<void>;
    redo(pageId: string): Promise<void>;
  }

  export interface LegacyStorePort {
    readonly [key: string]: unknown;
  }

  export interface LegacyRuntimeBridge {
    readonly baseline: string;
    readonly PageStore?: LegacyPageStorePort;
    readonly BlockStore?: LegacyBlockStorePort;
    readonly LinkStore?: LegacyLinkStorePort;
    readonly DatabaseStore?: LegacyStorePort;
    readonly RagLibraryStore?: LegacyStorePort;
    readonly RagFolderStore?: LegacyStorePort;
    readonly LocalMCPBridge?: LegacyStorePort;
    readonly AppState?: LegacyStorePort;
    readonly App?: LegacyStorePort;
    readonly DBM?: LegacyDbManagerPort;
    readonly Cache?: LegacyCachePort;
    readonly CacheIndex?: LegacyCacheIndexPort;
    readonly StorageConfig?: LegacyStorageConfigPort;
    readonly UndoManager?: LegacyUndoManagerPort;
    readonly isTeamPageId?: (pageId: string) => boolean;
    readonly uid?: (prefix: string) => string;
    readonly now?: () => number;
  }

  export function legacy(): LegacyRuntimeBridge | null {
    return window.__GPT_LEGACY__ ?? null;
  }

  export function requireLegacy(): LegacyRuntimeBridge {
    const bridge = legacy();
    if (!bridge) throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'Legacy compatibility bridge가 준비되지 않았습니다.');
    return bridge;
  }
}
