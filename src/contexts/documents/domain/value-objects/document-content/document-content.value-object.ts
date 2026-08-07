import { StringValueObject } from '@sisques-labs/nestjs-kit';

/**
 * Max length is NOT enforced here — DOCUMENTS_MAX_CONTENT_LENGTH is an
 * operational/deployment guardrail (tunable per self-hosted install via env
 * var), checked in the command handler. VOs shouldn't read process.env.
 */
export class DocumentContentValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { allowEmpty: false });
  }
}
