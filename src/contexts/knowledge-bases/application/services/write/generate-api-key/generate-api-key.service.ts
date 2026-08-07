import { Injectable } from '@nestjs/common';
import { IBaseService } from '@sisques-labs/nestjs-kit';
import { randomBytes } from 'crypto';

@Injectable()
export class GenerateApiKeyService implements IBaseService {
  async execute(): Promise<string> {
    return Promise.resolve(`kb_${randomBytes(32).toString('base64url')}`);
  }
}
