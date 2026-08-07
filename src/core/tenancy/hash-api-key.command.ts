export interface HashApiKeyCommandInput {
  rawKey: string;
}

/**
 * Internal only — no transport surface. Dispatched exclusively by bounded
 * contexts (via a port + adapter, e.g. knowledge-bases' `HashApiKeyAdapter`)
 * through the global CommandBus, so no context ever imports
 * `HashApiKeyService` directly.
 */
export class HashApiKeyCommand {
  public readonly rawKey: string;

  constructor(input: HashApiKeyCommandInput) {
    this.rawKey = input.rawKey;
  }
}
