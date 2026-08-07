import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { HashApiKeyService } from './hash-api-key.service';
import { HashApiKeyCommand } from './hash-api-key.command';

@CommandHandler(HashApiKeyCommand)
export class HashApiKeyCommandHandler implements ICommandHandler<
  HashApiKeyCommand,
  string
> {
  constructor(private readonly hashApiKey: HashApiKeyService) {}

  async execute(command: HashApiKeyCommand): Promise<string> {
    return this.hashApiKey.execute(command.rawKey);
  }
}
