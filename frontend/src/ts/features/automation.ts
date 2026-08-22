namespace GptNotion.Features.Automation {
  export interface AutomationStatus {
    readonly available: boolean;
    readonly source: 'mcp' | 'legacy' | 'none';
  }

  export function status(): AutomationStatus {
    const bridge = GptNotion.Infrastructure.legacy();
    return { available: Boolean(bridge?.LocalMCPBridge), source: bridge?.LocalMCPBridge ? 'legacy' : 'none' };
  }
}
