import { ApiException } from '../../../../common/exceptions/api.exception';

export class InvalidBlockTargetException extends ApiException {
  constructor() {
    super('Unknown block target type.', 404, {}, 'unknown_block_target');
  }
}
