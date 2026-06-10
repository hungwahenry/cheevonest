import { ApiException } from '../../../common/exceptions/api.exception';

export class PlaceNotFoundException extends ApiException {
  constructor() {
    super('Place not found.', 404, {}, 'place_not_found');
  }
}
