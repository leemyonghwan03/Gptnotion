namespace GptNotion.Ui {
  export interface ModuleHealthRow {
    readonly name: string;
    readonly ready: boolean;
    readonly detail: string;
  }

  export function collectHealth(): readonly ModuleHealthRow[] {
    const editor = GptNotion.Features.Editor.capabilities();
    return [
      { name: 'TypeScript Core', ready: true, detail: GptNotion.Core.APP_VERSION },
      { name: 'Legacy Compatibility', ready: editor.legacyRuntime, detail: GptNotion.Core.BASELINE_VERSION },
      { name: 'Editor Bridge', ready: editor.blockStore && editor.pageStore, detail: 'PageStore + BlockStore' },
      { name: 'RAG Service', ready: true, detail: 'MCP typed contract / FAST default' },
      { name: 'Compiler Guard', ready: GptNotion.Features.Operator.guard.compilerFirst, detail: 'strict / no bypass' }
    ];
  }
}
