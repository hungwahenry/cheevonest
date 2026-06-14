import { ApiException } from '../../../../common/exceptions/api.exception';

export class EmptyBroadcastAudienceException extends ApiException {
  constructor() {
    super(
      'This broadcast matched no recipients.',
      422,
      {},
      'empty_broadcast_audience',
    );
  }
}
