namespace GptNotion.App {
  export interface PublicApi {
    readonly version: string;
    readonly contractVersion: string;
    readonly baseline: string;
    readonly health: () => readonly GptNotion.Ui.ModuleHealthRow[];
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
