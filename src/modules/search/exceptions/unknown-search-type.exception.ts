import { ApiException } from '../../../common/exceptions/api.exception';

export class UnknownSearchTypeException extends ApiException {
  constructor(type: string) {
    super(`Unknown search type: ${type}`, 404, {}, 'unknown_search_type');
  }
}
