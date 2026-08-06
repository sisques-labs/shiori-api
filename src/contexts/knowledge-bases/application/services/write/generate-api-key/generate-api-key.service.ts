import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class GenerateApiKeyService {
  execute(): string {
    return `kb_${randomBytes(32).toString('base64url')}`;
  }
}
