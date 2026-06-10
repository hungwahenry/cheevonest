import { ApiException } from '../../../common/exceptions/api.exception';

export class BroadcastAudienceEmptyException extends ApiException {
  constructor() {
    super(
      'No one matches that audience yet — nothing to send.',
      422,
      {},
      'broadcast_audience_empty',
    );
  }
}
