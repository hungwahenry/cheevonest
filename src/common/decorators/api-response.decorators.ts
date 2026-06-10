import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'api:response_message';
export const SKIP_ENVELOPE_KEY = 'api:skip_envelope';

export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);

export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
