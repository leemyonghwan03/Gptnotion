namespace GptNotion.App {
  export interface PublicApi {
    readonly version: string;
    readonly contractVersion: string;
    readonly baseline: string;
    readonly health: () => readonly GptNotion.Ui.ModuleHealthRow[];
    readonly editor: {
      readonly capabilities: () => GptNotion.Features.Editor.EditorCapabilities;
      readonly createBlock: (pageId: string, afterBlockId: string | null, type?: GptNotion.Contracts.BlockType | string) => Promise<GptNotion.Contracts.BlockModel>;
      readonly updateBlock: (blockId: string, patch: GptNotion.Features.Editor.BlockPatch) => Promise<GptNotion.Contracts.BlockModel | null>;
      readonly deleteBlock: (blockId: string) => Promise<void>;
      readonly moveBlock: (blockId: string, targetBlockId: string, position: 'before' | 'after') => Promise<void>;
      readonly checkpoint: (pageId: string) => Promise<void>;
      readonly undo: (pageId: string) => Promise<void>;
      readonly redo: (pageId: string) => Promise<void>;
    };
    readonly rag: {
      readonly search: (query: string, options?: Partial<GptNotion.Contracts.RagSearchRequest>) => Promise<GptNotion.Contracts.RagSearchResponse>;
      readonly status: () => Promise<unknown>;
    };
    readonly mcp: {
      readonly health: () => Promise<GptNotion.Contracts.McpHealth>;
      readonly call: (name: string, args: Readonly<Record<string, unknown>>) => Promise<unknown>;
    };
  }
}
