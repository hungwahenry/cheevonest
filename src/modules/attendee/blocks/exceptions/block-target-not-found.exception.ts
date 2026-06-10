import { ApiException } from '../../../../common/exceptions/api.exception';

export class BlockTargetNotFoundException extends ApiException {
  constructor() {
    super("That target doesn't exist.", 404, {}, 'block_target_not_found');
  }
}
