interface Window {
  __GPT_LEGACY__?: GptNotion.Infrastructure.LegacyRuntimeBridge;
  GptNotionModular?: GptNotion.App.PublicApi;
}

namespace GptNotion.Infrastructure {
  export interface LegacyStorePort {
    readonly [key: string]: unknown;
  }

  export interface LegacyRuntimeBridge {
    readonly baseline: string;
    readonly PageStore?: LegacyStorePort;
    readonly BlockStore?: LegacyStorePort;
    readonly LinkStore?: LegacyStorePort;
    readonly DatabaseStore?: LegacyStorePort;
    readonly RagLibraryStore?: LegacyStorePort;
    readonly RagFolderStore?: LegacyStorePort;
    readonly LocalMCPBridge?: LegacyStorePort;
    readonly AppState?: LegacyStorePort;
    readonly App?: LegacyStorePort;
  }

  export function legacy(): LegacyRuntimeBridge | null {
    return window.__GPT_LEGACY__ ?? null;
  }

  export function requireLegacy(): LegacyRuntimeBridge {
    const bridge = legacy();
    if (!bridge) throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'Legacy compatibility bridge가 준비되지 않았습니다.');
    return bridge;
  }
}
