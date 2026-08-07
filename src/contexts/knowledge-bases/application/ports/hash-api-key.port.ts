export const HASH_API_KEY_PORT = Symbol('HASH_API_KEY_PORT');

export interface IHashApiKeyPort {
  hash(rawKey: string): Promise<string>;
}
