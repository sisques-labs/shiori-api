import { ExecutionContext } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';

import { HashApiKeyService } from '@contexts/knowledge-bases/application/services/write/hash-api-key/hash-api-key.service';
import { KnowledgeBaseUnauthorizedException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-unauthorized.exception';

import { KnowledgeBaseApiKeyGuard } from './knowledge-base-api-key.guard';

function buildHttpContext(
  headers: Record<string, string>,
  req: Record<string, unknown> = {},
): ExecutionContext {
  req['headers'] = headers;
  return {
    getType: () => 'http',
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('KnowledgeBaseApiKeyGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let queryBus: jest.Mocked<QueryBus>;
  let hashApiKey: HashApiKeyService;
  let guard: KnowledgeBaseApiKeyGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as any;
    queryBus = { execute: jest.fn() } as any;
    hashApiKey = new HashApiKeyService();
    guard = new KnowledgeBaseApiKeyGuard(reflector, queryBus, hashApiKey);
  });

  it('bypasses the query dispatch when @SkipKnowledgeBaseAuth() is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = buildHttpContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(queryBus.execute).not.toHaveBeenCalled();
  });

  it('throws KnowledgeBaseUnauthorizedException when the header is missing', async () => {
    const context = buildHttpContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      KnowledgeBaseUnauthorizedException,
    );
  });

  it('throws KnowledgeBaseUnauthorizedException when no knowledge base matches', async () => {
    queryBus.execute.mockResolvedValue(null);
    const context = buildHttpContext({ 'x-api-key': 'kb_unknown' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      KnowledgeBaseUnauthorizedException,
    );
  });

  it('sets req.knowledgeBaseId and returns true on a valid key', async () => {
    queryBus.execute.mockResolvedValue({ id: 'kb-1' } as any);
    const req: Record<string, unknown> = {};
    const context = buildHttpContext({ 'x-api-key': 'kb_valid' }, req);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req['knowledgeBaseId']).toBe('kb-1');
    expect(queryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ hash: hashApiKey.execute('kb_valid') }),
    );
  });
});
