namespace GptNotion.Infrastructure {
  interface StoredPageModel extends GptNotion.Contracts.PageModel {
    share?: {
      enabled: boolean;
      shareId: string | null;
      permission: string;
    };
    storageScope?: string;
  }

  interface StoredBlockModel extends GptNotion.Contracts.BlockModel {
    storageScope?: string;
  }

  function requireDbm(): LegacyDbManagerPort {
    const dbm = requireLegacy().DBM;
    if (!dbm) throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'IndexedDB 호환 저장 계층이 준비되지 않았습니다.');
    return dbm;
  }

  function requireCache(): LegacyCachePort {
    const cache = requireLegacy().Cache;
    if (!cache) throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'Legacy cache가 준비되지 않았습니다.');
    return cache;
  }

  function timestamp(): number {
    return requireLegacy().now?.() ?? Date.now();
  }

  function identifier(prefix: string): string {
    const factory = requireLegacy().uid;
    if (factory) return factory(prefix);
    return `${prefix}_${timestamp().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  export function usesLegacyStorage(pageId?: string | null): boolean {
    const runtime = requireLegacy();
    if (runtime.StorageConfig?.isLocal()) return true;
    return Boolean(pageId && runtime.isTeamPageId?.(pageId));
  }

  function syncPageCreate(page: GptNotion.Contracts.PageModel): void {
    const cache = requireCache();
    if (!cache.pages.some(item => item.id === page.id)) cache.pages.push(page);
    requireLegacy().CacheIndex?.addPage(page);
  }

  function syncPageUpdate(page: GptNotion.Contracts.PageModel, oldParentId: string | null): void {
    const cache = requireCache();
    const current = cache.pages.find(item => item.id === page.id);
    if (current) Object.assign(current, page);
    else cache.pages.push(page);
    requireLegacy().CacheIndex?.updatePage(current ?? page, oldParentId);
  }

  function syncBlockCreate(block: GptNotion.Contracts.BlockModel): void {
    const cache = requireCache();
    if (!cache.blocks.some(item => item.id === block.id)) cache.blocks.push(block);
    requireLegacy().CacheIndex?.addBlock(block);
  }

  function syncBlockUpdate(block: GptNotion.Contracts.BlockModel, oldPageId: string, oldOrder: number): void {
    const cache = requireCache();
    const current = cache.blocks.find(item => item.id === block.id);
    if (current) Object.assign(current, block);
    else cache.blocks.push(block);
    requireLegacy().CacheIndex?.updateBlock(current ?? block, oldPageId, oldOrder);
  }

  export class IndexedDbPageRepository implements GptNotion.Domain.Page.PageRepository {
    public async get(id: string): Promise<GptNotion.Contracts.PageModel | null> {
      const cached = requireCache().pages.find(page => page.id === id) ?? null;
      if (cached) return cached;
      if (usesLegacyStorage(id)) return requireLegacy().PageStore?.get(id) ?? null;
      return requireDbm().rawIDBGet<GptNotion.Contracts.PageModel>('pages', id);
    }

    public async list(): Promise<readonly GptNotion.Contracts.PageModel[]> {
      if (requireLegacy().StorageConfig?.isLocal()) return requireLegacy().PageStore?.getAll() ?? [];
      return requireCache().pages;
    }

    public async create(command: GptNotion.Domain.Page.CreatePageCommand): Promise<GptNotion.Contracts.PageModel> {
      if (usesLegacyStorage(command.parentId)) {
        const store = requireLegacy().PageStore;
        if (!store) throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'PageStore compatibility path가 준비되지 않았습니다.');
        const page = await store.create(command);
        syncPageCreate(page);
        return page;
      }
      const now = timestamp();
      const page: StoredPageModel = {
        id: identifier('page'),
        title: command.title || '제목 없음',
        icon: command.icon || '📄',
        parentId: command.parentId || null,
        pinned: false,
        deleted: false,
        createdAt: now,
        updatedAt: now,
        accessedAt: now,
        share: { enabled: false, shareId: null, permission: 'view' }
      };
      await requireDbm().rawIDBPut('pages', page);
      syncPageCreate(page);
      return page;
    }

    public async update(page: GptNotion.Contracts.PageModel): Promise<void> {
      const existing = requireCache().pages.find(item => item.id === page.id);
      const oldParentId = existing?.parentId ?? page.parentId;
      if (usesLegacyStorage(page.id)) {
        const store = requireLegacy().PageStore;
        if (!store) throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'PageStore compatibility path가 준비되지 않았습니다.');
        const updated = await store.update(page.id, page);
        if (updated) syncPageUpdate(updated, oldParentId);
        return;
      }
      await requireDbm().rawIDBPut('pages', page);
      syncPageUpdate(page, oldParentId);
    }
  }

  export class IndexedDbBlockRepository implements GptNotion.Domain.Block.BlockRepository {
    public async get(id: string): Promise<GptNotion.Contracts.BlockModel | null> {
      const cached = requireCache().blocks.find(block => block.id === id) ?? null;
      if (cached) return cached;
      return requireDbm().rawIDBGet<GptNotion.Contracts.BlockModel>('blocks', id);
    }

    public async listByPage(pageId: string): Promise<readonly GptNotion.Contracts.BlockModel[]> {
      const cached = requireCache().blocks.filter(block => block.pageId === pageId).sort((a, b) => a.order - b.order);
      if (cached.length || usesLegacyStorage(pageId)) return cached;
      const all = await requireDbm().rawIDBGetAll<GptNotion.Contracts.BlockModel>('blocks');
      return all.filter(block => block.pageId === pageId).sort((a, b) => a.order - b.order);
    }

    public async create(command: GptNotion.Domain.Block.CreateBlockCommand): Promise<GptNotion.Contracts.BlockModel> {
      if (usesLegacyStorage(command.pageId)) {
        const store = requireLegacy().BlockStore;
        if (!store) throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'BlockStore compatibility path가 준비되지 않았습니다.');
        const block = await store.create(command);
        syncBlockCreate(block);
        return block;
      }
      const now = timestamp();
      const block: StoredBlockModel = {
        id: identifier('block'),
        pageId: command.pageId,
        type: command.type || 'paragraph',
        content: command.content || '',
        depth: command.depth || 0,
        properties: {},
        order: command.order,
        createdAt: now,
        updatedAt: now
      };
      await requireDbm().rawIDBPut('blocks', block);
      syncBlockCreate(block);
      return block;
    }

    public async update(block: GptNotion.Contracts.BlockModel): Promise<void> {
      const existing = requireCache().blocks.find(item => item.id === block.id);
      const oldPageId = existing?.pageId ?? block.pageId;
      const oldOrder = existing?.order ?? block.order;
      if (usesLegacyStorage(block.pageId)) {
        const store = requireLegacy().BlockStore;
        if (!store) throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'BlockStore compatibility path가 준비되지 않았습니다.');
        const updated = await store.update(block.id, block);
        if (updated) syncBlockUpdate(updated, oldPageId, oldOrder);
        return;
      }
      await requireDbm().rawIDBPut('blocks', block);
      syncBlockUpdate(block, oldPageId, oldOrder);
    }

    public async remove(id: string): Promise<void> {
      const runtime = requireLegacy();
      const existing = requireCache().blocks.find(block => block.id === id) ?? null;
      if (!existing) return;
      if (usesLegacyStorage(existing.pageId)) {
        const store = runtime.BlockStore;
        if (!store) throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'BlockStore compatibility path가 준비되지 않았습니다.');
        await store.delete(id);
        runtime.CacheIndex?.removeBlock(existing);
        return;
      }
      const cache = requireCache();
      const links = cache.links.filter(link => link.sourceBlockId === id);
      await requireDbm().rawIDBAtomicBatch({
        deletes: {
          blocks: [id],
          links: links.map(link => link.id)
        }
      });
      cache.blocks = cache.blocks.filter(block => block.id !== id);
      const removedLinkIds = new Set(links.map(link => link.id));
      cache.links = cache.links.filter(link => !removedLinkIds.has(link.id));
      runtime.CacheIndex?.removeBlock(existing);
      for (const link of links) runtime.CacheIndex?.removeLink(link);
    }
  }

  export const pageRepository: GptNotion.Domain.Page.PageRepository = new IndexedDbPageRepository();
  export const blockRepository: GptNotion.Domain.Block.BlockRepository = new IndexedDbBlockRepository();

  export function editorNow(): number { return timestamp(); }
  export function editorUsesLegacyStorage(pageId: string): boolean { return usesLegacyStorage(pageId); }
  export function legacyUndoManager(): LegacyUndoManagerPort | null { return requireLegacy().UndoManager ?? null; }
}
