import { ConfigService } from '@nestjs/config';

import { DocumentTooManyChunksException } from '@contexts/documents/domain/exceptions/document-too-many-chunks.exception';

import { RecursiveChunkingService } from './recursive-chunking.service';

function buildService(maxChunks = 2000): RecursiveChunkingService {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue({ maxChunks }),
  } as unknown as ConfigService;
  return new RecursiveChunkingService(configService);
}

describe('RecursiveChunkingService', () => {
  it('splits paragraphs and assigns sequential positions', () => {
    const service = buildService();
    const paragraph = (n: number) => `Paragraph ${n} content here.`;
    const content = [paragraph(1), paragraph(2), paragraph(3)].join('\n\n');

    const chunks = service.chunk(content);

    expect(chunks.map((c) => c.position)).toEqual([0]);
    expect(chunks[0].text).toContain('Paragraph 1');
    expect(chunks[0].text).toContain('Paragraph 3');
  });

  it('produces overlapping text between adjacent chunks when content exceeds the target size', () => {
    const service = buildService();
    // Each paragraph is long enough that merging them exceeds the ~1000
    // char target, forcing at least one chunk boundary with carried overlap.
    const longParagraph = (label: string) => `${label} `.repeat(120).trim();
    const content = [longParagraph('alpha'), longParagraph('beta')].join(
      '\n\n',
    );

    const chunks = service.chunk(content);

    expect(chunks.length).toBeGreaterThan(1);
    const firstTail = chunks[0].text.slice(-150);
    expect(chunks[1].text.startsWith(firstTail)).toBe(true);
  });

  it('falls back to sentence/char splitting for a single long paragraph with no newlines', () => {
    const service = buildService();
    const sentence = 'This is one sentence of reasonable length. ';
    const content = sentence.repeat(60); // no \n\n or \n at all

    const chunks = service.chunk(content);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });

  it('throws DocumentTooManyChunksException when the result exceeds maxChunks', () => {
    const service = buildService(2);
    const paragraph = (n: number) => `Paragraph ${n} `.repeat(120).trim();
    const content = [
      paragraph(1),
      paragraph(2),
      paragraph(3),
      paragraph(4),
    ].join('\n\n');

    expect(() => service.chunk(content)).toThrow(
      DocumentTooManyChunksException,
    );
  });

  it('returns a single chunk for short content', () => {
    const service = buildService();
    const chunks = service.chunk('Just a short document.');

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ text: 'Just a short document.', position: 0 });
  });
});
