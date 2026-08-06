import { redisConfig } from './redis.config';

describe('redisConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults host to localhost and port to 6379 when unset', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;

    const config = redisConfig();

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(6379);
    expect(config.password).toBeUndefined();
  });

  it('reads host/port/password from env vars when set', () => {
    process.env.REDIS_HOST = 'redis.internal';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'secret';

    const config = redisConfig();

    expect(config.host).toBe('redis.internal');
    expect(config.port).toBe(6380);
    expect(config.password).toBe('secret');
  });

  it('treats an empty REDIS_PASSWORD as undefined', () => {
    process.env.REDIS_PASSWORD = '';

    expect(redisConfig().password).toBeUndefined();
  });
});
