import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { HashApiKeyCommand } from '@core/tenancy/hash-api-key.command';

import { IHashApiKeyPort } from '@contexts/knowledge-bases/application/ports/hash-api-key.port';

@Injectable()
export class HashApiKeyAdapter implements IHashApiKeyPort {
  constructor(private readonly commandBus: CommandBus) {}

  async hash(rawKey: string): Promise<string> {
    return this.commandBus.execute<HashApiKeyCommand, string>(
      new HashApiKeyCommand({ rawKey }),
    );
  }
}
