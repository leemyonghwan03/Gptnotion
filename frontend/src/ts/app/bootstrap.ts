namespace GptNotion.App {
  function createApi(): PublicApi {
    return {
      version: GptNotion.Core.APP_VERSION,
      contractVersion: GptNotion.Core.CONTRACT_VERSION,
      baseline: GptNotion.Core.BASELINE_VERSION,
      health: () => GptNotion.Ui.collectHealth(),
      editor: {
        capabilities: () => GptNotion.Features.Editor.capabilities(),
        createBlock: (pageId, afterBlockId, type) => GptNotion.Features.Editor.createBlock(pageId, afterBlockId, type),
        updateBlock: (blockId, patch) => GptNotion.Features.Editor.updateBlock(blockId, patch),
        deleteBlock: blockId => GptNotion.Features.Editor.deleteBlock(blockId),
        moveBlock: (blockId, targetBlockId, position) => GptNotion.Features.Editor.moveBlock(blockId, targetBlockId, position),
        checkpoint: pageId => GptNotion.Features.Editor.checkpoint(pageId),
        undo: pageId => GptNotion.Features.Editor.undo(pageId),
        redo: pageId => GptNotion.Features.Editor.redo(pageId)
      },
      rag: {
        search: (query, options) => GptNotion.Features.Rag.searchService.search(query, options),
        status: () => GptNotion.Features.Rag.searchService.status()
      },
      mcp: {
        health: () => GptNotion.Infrastructure.mcpClient.health(),
        call: (name, args) => GptNotion.Infrastructure.mcpClient.callRaw(name, args)
      }
    };
  }

  export function bootstrap(): void {
    if (window.GptNotionModular) return;
    window.GptNotionModular = createApi();
    document.documentElement.dataset.gptnotionModular = GptNotion.Core.APP_VERSION;
    window.dispatchEvent(new CustomEvent('gptnotion:modular-ready', { detail: { version: GptNotion.Core.APP_VERSION } }));
  }
}

GptNotion.App.bootstrap();
