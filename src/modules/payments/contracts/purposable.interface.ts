export interface PaymentPurposable {
  readonly purposableType: string;
  returnParams(
    purposableId: string,
  ): Record<string, string> | Promise<Record<string, string>>;
}
