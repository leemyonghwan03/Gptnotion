namespace GptNotion.Domain.Settings {
  export interface AiSettings {
    readonly apiMode: 'chat' | 'responses';
    readonly endpoint: string;
    readonly apiKey: string;
    readonly model: string;
  }

  export interface AppSettings {
    readonly storageMode: GptNotion.Contracts.StorageMode;
    readonly ai: AiSettings;
    readonly ragSearchMode: GptNotion.Contracts.SearchMode;
  }
}
