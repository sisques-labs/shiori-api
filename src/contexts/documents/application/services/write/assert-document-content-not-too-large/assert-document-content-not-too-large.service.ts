import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IBaseService } from '@sisques-labs/nestjs-kit';

import { DocumentContentTooLargeException } from '@contexts/documents/domain/exceptions/document-content-too-large.exception';
import { DocumentsConfig } from '@contexts/documents/infrastructure/config/documents.config';

@Injectable()
export class AssertDocumentContentNotTooLargeService implements IBaseService<
  string,
  void
> {
  private readonly maxContentLength: number;

  constructor(configService: ConfigService) {
    this.maxContentLength =
      configService.getOrThrow<DocumentsConfig>('documents').maxContentLength;
  }

  async execute(content: string): Promise<void> {
    if (content.length > this.maxContentLength) {
      throw new DocumentContentTooLargeException(
        content.length,
        this.maxContentLength,
      );
    }
  }
}
