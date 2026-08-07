import { KnowledgeBaseContext } from './knowledge-base-context.service';
import { KnowledgeBaseContextMissingException } from './exceptions/knowledge-base-context-missing.exception';

describe('KnowledgeBaseContext', () => {
  let context: KnowledgeBaseContext;

  beforeEach(() => {
    context = new KnowledgeBaseContext();
  });

  it('returns undefined when called outside run()', () => {
    expect(context.get()).toBeUndefined();
  });

  it('require() throws when unset', () => {
    expect(() => context.require()).toThrow(
      KnowledgeBaseContextMissingException,
    );
  });

  it('scopes get()/require() to the run() callback', () => {
    context.run('kb-1', () => {
      expect(context.get()).toBe('kb-1');
      expect(context.require()).toBe('kb-1');
    });
    expect(context.get()).toBeUndefined();
  });

  it('isolates knowledgeBaseId across concurrent async runs', async () => {
    const observed: string[] = [];

    const runOne = (id: string, delayMs: number) =>
      context.run(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        observed.push(context.require());
      });

    await Promise.all([runOne('kb-1', 10), runOne('kb-2', 0)]);

    expect(observed.sort()).toEqual(['kb-1', 'kb-2']);
  });

  it('propagates the return value of the callback', () => {
    const result = context.run('kb-1', () => 42);
    expect(result).toBe(42);
  });
});
