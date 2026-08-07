import { CommandBus } from '@nestjs/cqrs';

import { HashApiKeyAdapter } from './hash-api-key.adapter';

describe('HashApiKeyAdapter', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let adapter: HashApiKeyAdapter;

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    adapter = new HashApiKeyAdapter(commandBus);
  });

  it('dispatches HashApiKeyCommand via the global CommandBus', async () => {
    commandBus.execute.mockResolvedValue('a'.repeat(64));

    const result = await adapter.hash('kb_plaintext');

    expect(result).toBe('a'.repeat(64));
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ rawKey: 'kb_plaintext' }),
    );
  });
});
