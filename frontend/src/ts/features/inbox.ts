namespace GptNotion.Features.Inbox {
  export interface InboxDraft {
    readonly content: string;
    readonly createdAt: number;
  }

  export function createDraft(content: string): InboxDraft {
    const normalized = content.trim();
    if (!normalized) throw new GptNotion.Core.AppError('VALIDATION_ERROR', 'Inbox 내용은 비어 있을 수 없습니다.');
    return { content: normalized, createdAt: Date.now() };
  }
}
