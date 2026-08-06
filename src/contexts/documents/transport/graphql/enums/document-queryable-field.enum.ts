/**
 * Whitelist of `Document` fields a client can filter/sort by via
 * `documentFindByCriteria`. Transport-only — not a domain concept, so it
 * lives here rather than in `domain/enums/`.
 *
 * `knowledgeBaseId` is deliberately excluded: every query is already
 * implicitly scoped to the caller's knowledge base via `KnowledgeBaseContext`,
 * so exposing it as a client-choosable filter would be redundant. `content`
 * is excluded too — free-text filtering belongs to `retrieval`'s semantic
 * search, not this structured criteria pattern.
 */
export enum DocumentQueryableField {
  ID = 'id',
  TITLE = 'title',
  STATUS = 'status',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}
