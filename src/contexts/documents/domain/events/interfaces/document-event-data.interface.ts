import { IDocumentPrimitives } from '@contexts/documents/domain/primitives/document.primitives';

export type IDocumentEventData = Pick<
  IDocumentPrimitives,
  'id' | 'knowledgeBaseId' | 'status'
>;
