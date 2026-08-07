import { HashApiKeyCommand } from './hash-api-key.command';
import { HashApiKeyCommandHandler } from './hash-api-key.command-handler';
import { HashApiKeyService } from './hash-api-key.service';

describe('HashApiKeyCommandHandler', () => {
  let handler: HashApiKeyCommandHandler;

  beforeEach(() => {
    handler = new HashApiKeyCommandHandler(new HashApiKeyService());
  });

  it('returns the SHA-256 hex digest of the raw key', async () => {
    const result = await handler.execute(
      new HashApiKeyCommand({ rawKey: 'kb_plaintext' }),
    );

    expect(result).toBe(new HashApiKeyService().execute('kb_plaintext'));
  });
});
