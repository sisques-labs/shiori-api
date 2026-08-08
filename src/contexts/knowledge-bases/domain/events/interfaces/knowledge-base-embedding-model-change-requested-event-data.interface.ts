export interface IKnowledgeBaseEmbeddingModelChangeRequestedEventData {
  knowledgeBaseId: string;
  previousModel: string;
  newModel: string;
}
