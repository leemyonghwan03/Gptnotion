namespace GptNotion.Features.Operator {
  export interface OperatorGuard {
    readonly contractVersion: string;
    readonly compilerFirst: true;
    readonly unsafeTypeEscapeAllowed: false;
  }

  export const guard: OperatorGuard = {
    contractVersion: GptNotion.Core.CONTRACT_VERSION,
    compilerFirst: true,
    unsafeTypeEscapeAllowed: false
  };
}
