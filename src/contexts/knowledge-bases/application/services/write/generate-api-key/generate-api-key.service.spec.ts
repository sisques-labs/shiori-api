import { GenerateApiKeyService } from './generate-api-key.service';

describe('GenerateApiKeyService', () => {
  let service: GenerateApiKeyService;

  beforeEach(() => {
    service = new GenerateApiKeyService();
  });

  it('returns a string starting with kb_', async () => {
    await expect(service.execute()).resolves.toMatch(/^kb_/);
  });

  it('generates a different key on each call', async () => {
    const [first, second] = await Promise.all([
      service.execute(),
      service.execute(),
    ]);
    expect(first).not.toBe(second);
  });
});
