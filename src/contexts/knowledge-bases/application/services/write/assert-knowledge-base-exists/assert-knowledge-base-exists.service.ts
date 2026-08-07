import { Inject, Injectable } from '@nestjs/common';
import { IBaseService } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseNotFoundException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-not-found.exception';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';

@Injectable()
export class AssertKnowledgeBaseExistsService implements IBaseService {
  constructor(
    @Inject(KNOWLEDGE_BASE_WRITE_REPOSITORY)
    private readonly writeRepository: IKnowledgeBaseWriteRepository,
  ) {}

  async execute(
    id: KnowledgeBaseIdValueObject,
  ): Promise<KnowledgeBaseAggregate> {
    const knowledgeBase = await this.writeRepository.findById(id.value);
    if (!knowledgeBase) throw new KnowledgeBaseNotFoundException(id.value);
    return knowledgeBase;
  }
}
