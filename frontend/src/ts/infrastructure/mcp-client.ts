namespace GptNotion.Infrastructure {
  export interface McpClientOptions {
    readonly baseUrl: string;
    readonly timeoutMs: number;
  }

  export class McpClient {
    private baseUrl: string;
    private timeoutMs: number;

    public constructor(options: McpClientOptions) {
      this.baseUrl = options.baseUrl.replace(/\/+$/, '');
      this.timeoutMs = Math.max(500, options.timeoutMs);
    }

    public configure(options: Partial<McpClientOptions>): void {
      if (typeof options.baseUrl === 'string' && options.baseUrl.trim()) {
        this.baseUrl = options.baseUrl.trim().replace(/\/+$/, '');
      }
      if (typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs)) {
        this.timeoutMs = Math.max(500, options.timeoutMs);
      }
    }

    public async health(): Promise<GptNotion.Contracts.McpHealth> {
      const raw = await this.request('/health', { method: 'GET' });
      return GptNotion.Contracts.parseMcpHealth(raw);
    }

    public async call<T>(name: string, args: Readonly<Record<string, unknown>>, parse: (value: unknown) => T): Promise<T> {
      const raw = await this.callEnvelope(name, args);
      return parse(raw);
    }

    public async callRaw(name: string, args: Readonly<Record<string, unknown>>): Promise<unknown> {
      return this.callEnvelope(name, args);
    }


    private async callEnvelope(name: string, args: Readonly<Record<string, unknown>>): Promise<unknown> {
      const raw = await this.request('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, arguments: args })
      });
      if (!GptNotion.Core.isRecord(raw) || raw.ok !== true || !('result' in raw)) {
        throw new GptNotion.Core.AppError('MCP_PROTOCOL_ERROR', 'MCP bridge 응답 형식이 올바르지 않습니다.');
      }
      return raw.result;
    }

    private async request(path: string, init: RequestInit): Promise<unknown> {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(this.baseUrl + path, { ...init, signal: controller.signal });
        const text = await response.text();
        let payload: unknown = null;
        if (text) {
          try { payload = JSON.parse(text); }
          catch { payload = { message: text }; }
        }
        if (!response.ok) {
          const detail = GptNotion.Core.isRecord(payload) && typeof payload.error === 'string'
            ? payload.error : `HTTP ${response.status}`;
          throw new GptNotion.Core.AppError('MCP_PROTOCOL_ERROR', 'Local MCP 요청이 실패했습니다.', detail);
        }
        return payload;
      } catch (error) {
        if (error instanceof GptNotion.Core.AppError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new GptNotion.Core.AppError('MCP_UNAVAILABLE', 'Local MCP에 연결할 수 없습니다.', message);
      } finally {
        window.clearTimeout(timer);
      }
    }
  }

  export const mcpClient = new McpClient({ baseUrl: 'http://127.0.0.1:37841', timeoutMs: 15000 });
}
