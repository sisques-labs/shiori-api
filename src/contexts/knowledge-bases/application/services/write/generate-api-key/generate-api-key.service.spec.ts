import { GenerateApiKeyService } from './generate-api-key.service';

describe('GenerateApiKeyService', () => {
  let service: GenerateApiKeyService;

  beforeEach(() => {
    service = new GenerateApiKeyService();
  });

  it('returns a string starting with kb_', () => {
    expect(service.execute()).toMatch(/^kb_/);
  });

  it('generates a different key on each call', () => {
    expect(service.execute()).not.toBe(service.execute());
  });
});
