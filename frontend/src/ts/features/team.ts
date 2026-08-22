namespace GptNotion.Features.Team {
  export interface TeamCapability {
    readonly legacyTeamRuntime: boolean;
    readonly offlineFirst: true;
  }

  export function capability(): TeamCapability {
    return { legacyTeamRuntime: Boolean(GptNotion.Infrastructure.legacy()), offlineFirst: true };
  }
}
