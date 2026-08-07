import { Inject, Injectable } from '@nestjs/common';
import { IBaseService } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseNotFoundException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-not-found.exception';
import {
  KNOWLEDGE_BASE_READ_REPOSITORY,
  IKnowledgeBaseReadRepository,
} from '@contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';

@Injectable()
export class AssertKnowledgeBaseViewModelExistsService implements IBaseService {
  constructor(
    @Inject(KNOWLEDGE_BASE_READ_REPOSITORY)
    private readonly readRepository: IKnowledgeBaseReadRepository,
  ) {}

  async execute(id: string): Promise<KnowledgeBaseViewModel> {
    const viewModel = await this.readRepository.findById(id);
    if (!viewModel) throw new KnowledgeBaseNotFoundException(id);
    return viewModel;
  }
}
