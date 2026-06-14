import { ApiException } from '../../../../common/exceptions/api.exception';

export class BroadcastNotEditableException extends ApiException {
  constructor(status: string) {
    super(
      `A ${status} broadcast can no longer be edited.`,
      409,
      {},
      'broadcast_not_editable',
    );
  }
}
