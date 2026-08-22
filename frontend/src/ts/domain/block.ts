namespace GptNotion.Domain.Block {
  export interface CreateBlockCommand {
    readonly pageId: string;
    readonly type: GptNotion.Contracts.BlockType | string;
    readonly content: string;
    readonly depth: number;
    readonly order: number;
  }

  export interface BlockRepository {
    get(id: string): Promise<GptNotion.Contracts.BlockModel | null>;
    listByPage(pageId: string): Promise<readonly GptNotion.Contracts.BlockModel[]>;
    create(command: CreateBlockCommand): Promise<GptNotion.Contracts.BlockModel>;
    update(block: GptNotion.Contracts.BlockModel): Promise<void>;
    remove(id: string): Promise<void>;
  }

  export function normalizeDepth(depth: number): number {
    if (!Number.isFinite(depth)) return 0;
    return Math.max(0, Math.min(8, Math.trunc(depth)));
  }
}
