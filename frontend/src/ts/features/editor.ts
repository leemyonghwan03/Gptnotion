namespace GptNotion.Features.Editor {
  export interface EditorCapabilities {
    readonly blockStore: boolean;
    readonly pageStore: boolean;
    readonly legacyRuntime: boolean;
  }

  export interface BlockPatch {
    readonly type?: GptNotion.Contracts.BlockType | string;
    readonly content?: string;
    readonly depth?: number;
    readonly properties?: Readonly<Record<string, unknown>>;
    readonly order?: number;
  }

  interface EditorSnapshot {
    readonly title: string;
    readonly icon: string;
    readonly blocks: readonly GptNotion.Contracts.BlockModel[];
  }

  interface EditorUndoStack {
    undo: EditorSnapshot[];
    redo: EditorSnapshot[];
  }

  const stacks = new Map<string, EditorUndoStack>();
  const MAX_UNDO = 60;

  export function capabilities(): EditorCapabilities {
    const bridge = GptNotion.Infrastructure.legacy();
    return {
      blockStore: Boolean(bridge?.BlockStore),
      pageStore: Boolean(bridge?.PageStore),
      legacyRuntime: Boolean(bridge)
    };
  }

  export function assertReady(): void {
    const state = capabilities();
    if (!state.legacyRuntime || !state.blockStore || !state.pageStore) {
      throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'Editor 호환 계층이 준비되지 않았습니다.');
    }
  }

  function cloneValue<TValue>(value: TValue): TValue {
    return JSON.parse(JSON.stringify(value)) as TValue;
  }

  function stackFor(pageId: string): EditorUndoStack {
    const existing = stacks.get(pageId);
    if (existing) return existing;
    const created: EditorUndoStack = { undo: [], redo: [] };
    stacks.set(pageId, created);
    return created;
  }

  async function requiresLegacyUndo(pageId: string): Promise<boolean> {
    if (GptNotion.Infrastructure.editorUsesLegacyStorage(pageId)) return true;
    const blocks = await GptNotion.Infrastructure.blockRepository.listByPage(pageId);
    return blocks.some(block => block.type === 'database');
  }

  async function snapshot(pageId: string): Promise<EditorSnapshot | null> {
    const page = await GptNotion.Infrastructure.pageRepository.get(pageId);
    if (!page) return null;
    const blocks = await GptNotion.Infrastructure.blockRepository.listByPage(pageId);
    return {
      title: page.title,
      icon: page.icon,
      blocks: cloneValue(blocks)
    };
  }

  function sameSnapshot(left: EditorSnapshot, right: EditorSnapshot): boolean {
    return left.title === right.title && JSON.stringify(left.blocks) === JSON.stringify(right.blocks);
  }

  export async function checkpoint(pageId: string): Promise<void> {
    assertReady();
    if (await requiresLegacyUndo(pageId)) {
      GptNotion.Infrastructure.legacyUndoManager()?.pushUndo(pageId);
      return;
    }
    const current = await snapshot(pageId);
    if (!current) return;
    const stack = stackFor(pageId);
    const previous = stack.undo[stack.undo.length - 1];
    if (previous && sameSnapshot(previous, current)) return;
    stack.undo.push(current);
    if (stack.undo.length > MAX_UNDO) stack.undo.shift();
    stack.redo = [];
  }

  async function normalizeOrders(pageId: string): Promise<void> {
    const list = [...await GptNotion.Infrastructure.blockRepository.listByPage(pageId)].sort((a, b) => a.order - b.order);
    for (let index = 0; index < list.length; index += 1) {
      const block = list[index];
      if (!block || block.order === index) continue;
      await GptNotion.Infrastructure.blockRepository.update({ ...block, order: index });
    }
  }

  export async function createBlock(pageId: string, afterBlockId: string | null, type: GptNotion.Contracts.BlockType | string = 'paragraph'): Promise<GptNotion.Contracts.BlockModel> {
    assertReady();
    await checkpoint(pageId);
    const list = [...await GptNotion.Infrastructure.blockRepository.listByPage(pageId)];
    let order = list.length ? Math.max(...list.map(block => block.order)) + 1 : 0;
    if (afterBlockId) {
      const index = list.findIndex(block => block.id === afterBlockId);
      if (index >= 0) {
        const after = list[index];
        if (after) order = after.order + 0.5;
      }
    }
    const block = await GptNotion.Infrastructure.blockRepository.create({
      pageId,
      type,
      content: '',
      depth: 0,
      order
    });
    await normalizeOrders(pageId);
    return await GptNotion.Infrastructure.blockRepository.get(block.id) ?? block;
  }

  export async function updateBlock(blockId: string, patch: BlockPatch): Promise<GptNotion.Contracts.BlockModel | null> {
    assertReady();
    const current = await GptNotion.Infrastructure.blockRepository.get(blockId);
    if (!current) return null;
    await checkpoint(current.pageId);
    const next: GptNotion.Contracts.BlockModel = {
      ...current,
      type: patch.type ?? current.type,
      content: patch.content ?? current.content,
      depth: patch.depth === undefined ? current.depth : GptNotion.Domain.Block.normalizeDepth(patch.depth),
      properties: patch.properties ?? current.properties,
      order: patch.order ?? current.order,
      updatedAt: GptNotion.Infrastructure.editorNow()
    };
    await GptNotion.Infrastructure.blockRepository.update(next);
    return await GptNotion.Infrastructure.blockRepository.get(blockId);
  }

  export async function deleteBlock(blockId: string): Promise<void> {
    assertReady();
    const block = await GptNotion.Infrastructure.blockRepository.get(blockId);
    if (!block) return;
    await checkpoint(block.pageId);
    await GptNotion.Infrastructure.blockRepository.remove(blockId);
  }

  export async function moveBlock(blockId: string, targetBlockId: string, position: 'before' | 'after'): Promise<void> {
    assertReady();
    const moving = await GptNotion.Infrastructure.blockRepository.get(blockId);
    if (!moving) return;
    await checkpoint(moving.pageId);
    const list = [...await GptNotion.Infrastructure.blockRepository.listByPage(moving.pageId)];
    const filtered = list.filter(block => block.id !== blockId);
    let index = filtered.findIndex(block => block.id === targetBlockId);
    if (index === -1) index = filtered.length - 1;
    if (position === 'after') index += 1;
    filtered.splice(Math.max(0, index), 0, moving);
    for (let nextOrder = 0; nextOrder < filtered.length; nextOrder += 1) {
      const block = filtered[nextOrder];
      if (!block || block.order === nextOrder) continue;
      await GptNotion.Infrastructure.blockRepository.update({ ...block, order: nextOrder });
    }
  }

  async function restore(pageId: string, state: EditorSnapshot): Promise<void> {
    const page = await GptNotion.Infrastructure.pageRepository.get(pageId);
    if (!page) return;
    await GptNotion.Infrastructure.pageRepository.update({
      ...page,
      title: state.title,
      icon: state.icon,
      updatedAt: GptNotion.Infrastructure.editorNow()
    });
    const currentBlocks = await GptNotion.Infrastructure.blockRepository.listByPage(pageId);
    for (const block of currentBlocks) await GptNotion.Infrastructure.blockRepository.remove(block.id);
    for (const block of state.blocks) await GptNotion.Infrastructure.blockRepository.update(cloneValue(block));
  }

  export async function undo(pageId: string): Promise<void> {
    assertReady();
    if (await requiresLegacyUndo(pageId)) {
      await GptNotion.Infrastructure.legacyUndoManager()?.undo(pageId);
      return;
    }
    const stack = stackFor(pageId);
    const previous = stack.undo.pop();
    if (!previous) return;
    const current = await snapshot(pageId);
    if (current) stack.redo.push(current);
    await restore(pageId, previous);
  }

  export async function redo(pageId: string): Promise<void> {
    assertReady();
    if (await requiresLegacyUndo(pageId)) {
      await GptNotion.Infrastructure.legacyUndoManager()?.redo(pageId);
      return;
    }
    const stack = stackFor(pageId);
    const next = stack.redo.pop();
    if (!next) return;
    const current = await snapshot(pageId);
    if (current) stack.undo.push(current);
    await restore(pageId, next);
  }
}
