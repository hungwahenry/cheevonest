export const ORDER_PURPOSABLE = 'order';

/** Where an order originates. Drives per-channel platform fees (app is the incentivised path). */
export type OrderChannel = 'app' | 'web';
