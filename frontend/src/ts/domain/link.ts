namespace GptNotion.Domain.Link {
  export interface PageLink {
    readonly id: string;
    readonly sourcePageId: string;
    readonly targetPageId: string;
    readonly sourceBlockId: string | null;
    readonly kind: 'mention' | 'page-link';
  }

  export interface LinkRepository {
    bySource(pageId: string): Promise<readonly PageLink[]>;
    backlinks(pageId: string): Promise<readonly PageLink[]>;
  }
}
