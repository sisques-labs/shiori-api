import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { KnowledgeBaseContextInterceptor } from './knowledge-base-context.interceptor';
import { KnowledgeBaseContext } from './knowledge-base-context.service';

function buildHttpContext(req: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('KnowledgeBaseContextInterceptor', () => {
  let knowledgeBaseContext: jest.Mocked<KnowledgeBaseContext>;
  let interceptor: KnowledgeBaseContextInterceptor;

  beforeEach(() => {
    knowledgeBaseContext = {
      run: jest.fn((_id: string, fn: () => unknown) => fn()),
      get: jest.fn(),
      require: jest.fn(),
    } as any;
    interceptor = new KnowledgeBaseContextInterceptor(knowledgeBaseContext);
  });

  it('passes through without opening an ALS frame when knowledgeBaseId is absent', (done) => {
    const next: CallHandler = { handle: () => of('result') };

    interceptor.intercept(buildHttpContext({}), next).subscribe((value) => {
      expect(value).toBe('result');
      expect(knowledgeBaseContext.run).not.toHaveBeenCalled();
      done();
    });
  });

  it('wraps next.handle() in knowledgeBaseContext.run() when knowledgeBaseId is present', (done) => {
    const next: CallHandler = { handle: () => of('result') };

    interceptor
      .intercept(buildHttpContext({ knowledgeBaseId: 'kb-1' }), next)
      .subscribe((value) => {
        expect(value).toBe('result');
        expect(knowledgeBaseContext.run).toHaveBeenCalledWith(
          'kb-1',
          expect.any(Function),
        );
        done();
      });
  });
});
