namespace GptNotion.Features.Editor {
  export interface EditorCapabilities {
    readonly blockStore: boolean;
    readonly pageStore: boolean;
    readonly legacyRuntime: boolean;
  }

  export function capabilities(): EditorCapabilities {
    const bridge = GptNotion.Infrastructure.legacy();
    return {
      blockStore: Boolean(bridge?.BlockStore),
      pageStore: Boolean(bridge?.PageStore),
      legacyRuntime: Boolean(bridge)
    };
  }

  export function assertReady(): void {
    const state = capabilities();
    if (!state.legacyRuntime || !state.blockStore || !state.pageStore) {
      throw new GptNotion.Core.AppError('FEATURE_UNAVAILABLE', 'Editor 호환 계층이 준비되지 않았습니다.');
    }
  }
}
