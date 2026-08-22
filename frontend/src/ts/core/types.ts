namespace GptNotion.Core {
  export type JsonPrimitive = string | number | boolean | null;
  export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
  export interface JsonObject { [key: string]: JsonValue; }

  export type PageId = string & { readonly __brandPageId: unique symbol };
  export type BlockId = string & { readonly __brandBlockId: unique symbol };
  export type DatabaseId = string & { readonly __brandDatabaseId: unique symbol };
  export type RowId = string & { readonly __brandRowId: unique symbol };
  export type RagDocumentId = string & { readonly __brandRagDocumentId: unique symbol };
  export type RagChunkId = string & { readonly __brandRagChunkId: unique symbol };
  export type RagFolderId = string & { readonly __brandRagFolderId: unique symbol };

  export interface Timestamped {
    readonly createdAt: number;
    readonly updatedAt: number;
  }

  export type Result<T, E extends Error = Error> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: E };

  export function ok<T>(value: T): Result<T> { return { ok: true, value }; }
  export function fail<E extends Error>(error: E): Result<never, E> { return { ok: false, error }; }

  export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  export function asNonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  export function asFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
