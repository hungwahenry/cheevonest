import { Injectable, Logger } from '@nestjs/common';

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  async send(messages: ExpoPushMessage[]): Promise<void> {
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);

      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(chunk),
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          this.logger.warn(
            `Expo push send failed: ${response.status} ${await response.text().catch(() => '')}`,
          );
        }
      } catch (error) {
        this.logger.warn(`Expo push send errored: ${String(error)}`);
      }
    }
  }
}
