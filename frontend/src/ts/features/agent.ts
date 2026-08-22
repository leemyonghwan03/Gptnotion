namespace GptNotion.Features.Agent {
  export type AgentSource = 'chat' | 'topbar' | 'selection-ai' | 'page-ai' | 'ai-tools' | 'quick-reply';
  export type ConversationRole = 'user' | 'assistant';
  export type ReferenceKind = 'selection' | 'current-page' | 'previous-goal' | 'pending-option';

  export interface AgentContext {
    readonly source: AgentSource;
    readonly view: string;
    readonly pageId: string | null;
    readonly pageTitle: string | null;
    readonly selectedBlockIds: readonly string[];
    readonly selectedText: string | null;
  }

  export interface ClarificationOption {
    readonly id: string;
    readonly label: string;
  }

  export interface PendingClarification {
    readonly question: string;
    readonly options: readonly ClarificationOption[];
    readonly reason?: string;
    readonly originalGoal?: string;
  }

  export interface ConversationTurn {
    readonly role: ConversationRole;
    readonly text: string;
    readonly source: AgentSource;
    readonly at: number;
  }

  export interface ReferenceResolution {
    readonly kind: ReferenceKind;
    readonly label: string;
  }

  export interface AgentRequest {
    readonly source: AgentSource;
    readonly message: string;
    readonly context: AgentContext;
    readonly conversationId: string;
    readonly currentGoal: string | null;
    readonly pendingQuestion: PendingClarification | null;
  }

  export interface ConversationSnapshot {
    readonly conversationId: string;
    readonly currentGoal: string | null;
    readonly pendingQuestion: PendingClarification | null;
    readonly recentTurns: readonly ConversationTurn[];
    readonly corrections: readonly string[];
    readonly lastReference: ReferenceResolution | null;
  }

  function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  export function isCorrection(text: string): boolean {
    const normalized = normalizeText(text);
    return /^(아니|아냐|아니야|그게 아니라|정정|잠깐|아니 내가|내 말은)/.test(normalized)
      || /(?:말고|말한 건|뜻한 건|아니고)/.test(normalized);
  }

  export function isExplicitNewGoal(text: string): boolean {
    return /^(새 질문|다른 질문|주제 바꿀게|완전히 새로|이전 건 됐고)/.test(normalizeText(text));
  }

  export function isFollowUp(text: string): boolean {
    const normalized = normalizeText(text);
    if (!normalized || isExplicitNewGoal(normalized)) return false;
    if (normalized.length <= 45) return true;
    return /^(그리고|그럼|그러면|거기서|그중|그거|이거|여기|아까|방금|그 방식|그걸|이걸|그것도)/.test(normalized);
  }

  export function evolveGoal(previousGoal: string | null, userText: string): string | null {
    const next = normalizeText(userText);
    const previous = previousGoal ? normalizeText(previousGoal) : '';
    if (!next) return previous || null;
    if (!previous || isExplicitNewGoal(next)) return next;
    if (isCorrection(next)) return `${previous} → 사용자 정정: ${next}`;
    if (isFollowUp(next)) return `${previous} → 후속 요청: ${next}`;
    return next;
  }

  export class ConversationState {
    private readonly conversationIdValue: string;
    private goalValue: string | null = null;
    private pendingValue: PendingClarification | null = null;
    private readonly turnsValue: ConversationTurn[] = [];
    private readonly correctionsValue: string[] = [];
    private lastReferenceValue: ReferenceResolution | null = null;

    public constructor(conversationId: string) {
      const normalized = conversationId.trim();
      if (!normalized) throw new GptNotion.Core.AppError('VALIDATION_ERROR', 'conversationId가 비어 있습니다.');
      this.conversationIdValue = normalized;
    }

    public get conversationId(): string { return this.conversationIdValue; }
    public get currentGoal(): string | null { return this.goalValue; }
    public get pendingQuestion(): PendingClarification | null { return this.pendingValue; }
    public get recentTurns(): readonly ConversationTurn[] { return this.turnsValue; }

    public setGoal(goal: string): void {
      const normalized = normalizeText(goal);
      this.goalValue = normalized || null;
    }

    public evolveGoal(userText: string): void {
      const normalized = normalizeText(userText);
      this.goalValue = evolveGoal(this.goalValue, normalized);
      if (isCorrection(normalized)) {
        this.correctionsValue.push(normalized);
        if (this.correctionsValue.length > 6) this.correctionsValue.shift();
      }
    }

    public setPending(pending: PendingClarification | null): void {
      this.pendingValue = pending;
    }

    public setLastReference(reference: ReferenceResolution | null): void {
      this.lastReferenceValue = reference;
    }

    public recordTurn(role: ConversationRole, text: string, source: AgentSource, at: number = Date.now()): void {
      const normalized = normalizeText(text);
      if (!normalized) return;
      this.turnsValue.push({ role, text: normalized, source, at });
      if (this.turnsValue.length > 16) this.turnsValue.shift();
    }

    public snapshot(): ConversationSnapshot {
      return {
        conversationId: this.conversationIdValue,
        currentGoal: this.goalValue,
        pendingQuestion: this.pendingValue,
        recentTurns: this.turnsValue.slice(),
        corrections: this.correctionsValue.slice(),
        lastReference: this.lastReferenceValue
      };
    }
  }
}
