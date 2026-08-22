namespace GptNotion.Infrastructure {
  export interface KeyValueStore<TValue> {
    get(key: string): Promise<TValue | null>;
    put(key: string, value: TValue): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<readonly TValue[]>;
  }

  export interface StorageStatus {
    readonly mode: GptNotion.Contracts.StorageMode;
    readonly writable: boolean;
    readonly detail: string;
  }

  export class StorageGateway {
    private mode: GptNotion.Contracts.StorageMode = 'indexeddb';

    public setMode(mode: GptNotion.Contracts.StorageMode): void { this.mode = mode; }
    public getMode(): GptNotion.Contracts.StorageMode { return this.mode; }

    public async status(): Promise<StorageStatus> {
      if (this.mode === 'indexeddb') return { mode: this.mode, writable: true, detail: 'browser-indexeddb' };
      const health = await GptNotion.Infrastructure.mcpClient.health();
      return { mode: this.mode, writable: health.ok, detail: health.version ?? 'local-mcp' };
    }
  }

  export const storageGateway = new StorageGateway();
}
