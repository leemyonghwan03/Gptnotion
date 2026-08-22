namespace GptNotion.Domain.Page {
  export interface CreatePageCommand {
    readonly title: string;
    readonly parentId: string | null;
    readonly icon: string;
  }

  export interface PageRepository {
    get(id: string): Promise<GptNotion.Contracts.PageModel | null>;
    list(): Promise<readonly GptNotion.Contracts.PageModel[]>;
    create(command: CreatePageCommand): Promise<GptNotion.Contracts.PageModel>;
    update(page: GptNotion.Contracts.PageModel): Promise<void>;
  }

  export function validateCreate(command: CreatePageCommand): void {
    if (!command.title.trim()) throw new GptNotion.Core.AppError('VALIDATION_ERROR', '페이지 제목은 비어 있을 수 없습니다.');
    if (!command.icon.trim()) throw new GptNotion.Core.AppError('VALIDATION_ERROR', '페이지 아이콘은 비어 있을 수 없습니다.');
  }
}
