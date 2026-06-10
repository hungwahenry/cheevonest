import { Module } from '@nestjs/common';
import { OrganizerOrganisationsModule } from './organisations/organizer-organisations.module';

@Module({
  imports: [OrganizerOrganisationsModule],
})
export class OrganizerModule {}
