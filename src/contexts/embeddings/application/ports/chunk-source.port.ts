export const CHUNK_SOURCE_PORT = Symbol('CHUNK_SOURCE_PORT');

export interface IChunkSourceItem {
  id: string;
  text: string;
  position: number;
}

/**
 * Hexagonal seam over `documents`' chunk data. Implemented by
 * `infrastructure/adapters/document-chunk-source.adapter.ts`, backed by
 * `documents`' own exported `IChunkWriteRepository` — this context never
 * queries `documents`' tables directly.
 */
export interface IChunkSourcePort {
  findByDocumentId(documentId: string): Promise<IChunkSourceItem[]>;
}
