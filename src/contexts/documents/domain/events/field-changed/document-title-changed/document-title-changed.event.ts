import {
  BaseEvent,
  IEventMetadata,
  IFieldChangedEventData,
} from '@sisques-labs/nestjs-kit';

export class DocumentTitleChangedEvent extends BaseEvent<
  IFieldChangedEventData<string>
> {
  constructor(metadata: IEventMetadata, data: IFieldChangedEventData<string>) {
    super(metadata, data);
  }
}
