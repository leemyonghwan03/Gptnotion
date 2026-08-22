namespace GptNotion.Domain.Database {
  export type PropertyType = 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'url' | 'relation' | 'formula';

  export interface ColumnModel {
    readonly id: string;
    readonly databaseId: string;
    name: string;
    type: PropertyType;
    order: number;
  }

  export interface RowModel {
    readonly id: string;
    readonly databaseId: string;
    values: Readonly<Record<string, unknown>>;
    order: number;
  }

  export interface DatabaseRepository {
    get(id: string): Promise<GptNotion.Contracts.DatabaseModel | null>;
    listColumns(databaseId: string): Promise<readonly ColumnModel[]>;
    listRows(databaseId: string): Promise<readonly RowModel[]>;
  }
}
