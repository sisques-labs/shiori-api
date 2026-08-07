import { DeleteDocumentsByKnowledgeBaseService } from '@contexts/documents/application/services/write/delete-documents-by-knowledge-base/delete-documents-by-knowledge-base.service';

import { DeleteDocumentsByKnowledgeBaseCommand } from './delete-documents-by-knowledge-base.command';
import { DeleteDocumentsByKnowledgeBaseCommandHandler } from './delete-documents-by-knowledge-base.handler';

describe('DeleteDocumentsByKnowledgeBaseCommandHandler', () => {
  let deleteDocumentsByKnowledgeBase: jest.Mocked<DeleteDocumentsByKnowledgeBaseService>;
  let handler: DeleteDocumentsByKnowledgeBaseCommandHandler;

  beforeEach(() => {
    deleteDocumentsByKnowledgeBase = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as any;

    handler = new DeleteDocumentsByKnowledgeBaseCommandHandler(
      deleteDocumentsByKnowledgeBase,
    );
  });

  it('delegates to DeleteDocumentsByKnowledgeBaseService with the knowledgeBaseId', async () => {
    const command = new DeleteDocumentsByKnowledgeBaseCommand({
      knowledgeBaseId: 'kb-1',
    });

    await handler.execute(command);

    expect(deleteDocumentsByKnowledgeBase.execute).toHaveBeenCalledWith('kb-1');
  });
});
