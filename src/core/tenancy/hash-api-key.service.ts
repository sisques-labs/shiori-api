import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class HashApiKeyService {
  execute(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}
