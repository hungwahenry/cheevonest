export const REPORT_CREATED = 'report.created';

export class ReportCreatedEvent {
  constructor(
    readonly reportId: string,
    readonly targetType: string,
    readonly targetId: string,
  ) {}
}
