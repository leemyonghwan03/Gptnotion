namespace GptNotion.Features.Exporting {
  export interface ExportManifest {
    readonly schemaVersion: string;
    readonly exportedAt: number;
    readonly appVersion: string;
  }

  export function manifest(): ExportManifest {
    return { schemaVersion: GptNotion.Core.CONTRACT_VERSION, exportedAt: Date.now(), appVersion: GptNotion.Core.APP_VERSION };
  }
}
