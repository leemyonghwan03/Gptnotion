namespace GptNotion.Core {
  export type AppErrorCode =
    | 'VALIDATION_ERROR'
    | 'MCP_UNAVAILABLE'
    | 'MCP_PROTOCOL_ERROR'
    | 'STORAGE_ERROR'
    | 'CONTRACT_ERROR'
    | 'FEATURE_UNAVAILABLE';

  export class AppError extends Error {
    public readonly code: AppErrorCode;
    public readonly detail: string | null;

    public constructor(code: AppErrorCode, message: string, detail: string | null = null) {
      super(message);
      this.name = 'AppError';
      this.code = code;
      this.detail = detail;
    }
  }
}
