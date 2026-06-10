import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'api:skip_envelope';

export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
