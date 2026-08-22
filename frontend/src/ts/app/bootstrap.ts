namespace GptNotion.App {
  function createApi(): PublicApi {
    return {
      version: GptNotion.Core.APP_VERSION,
      contractVersion: GptNotion.Core.CONTRACT_VERSION,
      baseline: GptNotion.Core.BASELINE_VERSION,
      health: () => GptNotion.Ui.collectHealth(),
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
