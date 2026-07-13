export const ORGANISATION_CREATED = 'organisation.created';

export class OrganisationCreatedEvent {
  constructor(readonly organisationId: string) {}
}
