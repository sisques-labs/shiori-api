import { HashApiKeyService } from './hash-api-key.service';

describe('HashApiKeyService', () => {
  let service: HashApiKeyService;

  beforeEach(() => {
    service = new HashApiKeyService();
  });

  it('returns a 64-character lowercase hex digest', () => {
    const hash = service.execute('kb_sometestkey');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    expect(service.execute('kb_abc')).toBe(service.execute('kb_abc'));
  });

  it('produces different output for different input', () => {
    expect(service.execute('kb_abc')).not.toBe(service.execute('kb_def'));
  });
});
