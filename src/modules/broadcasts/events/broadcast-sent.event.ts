export const BROADCAST_SENT = 'broadcast.sent';

export class BroadcastSentEvent {
  constructor(readonly broadcastId: string) {}
}
