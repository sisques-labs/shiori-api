import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  IChunk,
  IChunkingStrategyPort,
} from '@contexts/documents/application/ports/chunking-strategy.port';
import { DocumentTooManyChunksException } from '@contexts/documents/domain/exceptions/document-too-many-chunks.exception';
import { DocumentsConfig } from '@contexts/documents/infrastructure/config/documents.config';

const TARGET_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

/**
 * Paragraph-first recursive split (`\n\n` → `\n` → sentence → hard char
 * split), then merges undersized segments toward `TARGET_CHUNK_SIZE`,
 * carrying the last `CHUNK_OVERLAP` characters of each chunk into the next
 * one so retrieval doesn't lose context at a chunk boundary.
 */
@Injectable()
export class RecursiveChunkingService implements IChunkingStrategyPort {
  private readonly maxChunks: number;

  constructor(configService: ConfigService) {
    this.maxChunks =
      configService.getOrThrow<DocumentsConfig>('documents').maxChunks;
  }

  chunk(content: string): IChunk[] {
    const segments = this.splitIntoSegments(content.trim());
    const merged = this.mergeSegments(segments);

    if (merged.length > this.maxChunks) {
      throw new DocumentTooManyChunksException(merged.length, this.maxChunks);
    }

    return merged.map((text, position) => ({ text, position }));
  }

  private splitIntoSegments(content: string): string[] {
    const paragraphs = content
      .split(/\n{2,}/)
      .filter((p) => p.trim().length > 0);
    const segments: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.length <= TARGET_CHUNK_SIZE) {
        segments.push(paragraph);
        continue;
      }
      segments.push(...this.splitParagraph(paragraph));
    }

    return segments;
  }

  private splitParagraph(paragraph: string): string[] {
    const lines = paragraph.split(/\n/).filter((l) => l.trim().length > 0);
    if (lines.length > 1) {
      return lines.flatMap((line) =>
        line.length <= TARGET_CHUNK_SIZE ? [line] : this.splitBySentence(line),
      );
    }
    return this.splitBySentence(paragraph);
  }

  private splitBySentence(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [text];
    const segments: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (
        (current + sentence).length > TARGET_CHUNK_SIZE &&
        current.length > 0
      ) {
        segments.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim().length > 0) segments.push(current.trim());

    return segments.flatMap((segment) =>
      segment.length <= TARGET_CHUNK_SIZE
        ? [segment]
        : this.splitByChar(segment),
    );
  }

  private splitByChar(text: string): string[] {
    const segments: string[] = [];
    let start = 0;
    while (start < text.length) {
      segments.push(text.slice(start, start + TARGET_CHUNK_SIZE));
      start += TARGET_CHUNK_SIZE;
    }
    return segments;
  }

  private mergeSegments(segments: string[]): string[] {
    const merged: string[] = [];
    let current = '';

    for (const segment of segments) {
      const candidate =
        current.length > 0 ? `${current}\n\n${segment}` : segment;
      if (candidate.length > TARGET_CHUNK_SIZE && current.length > 0) {
        merged.push(current);
        const overlapText = current.slice(-CHUNK_OVERLAP);
        current = `${overlapText}\n\n${segment}`;
      } else {
        current = candidate;
      }
    }
    if (current.length > 0) merged.push(current);

    return merged;
  }
}
