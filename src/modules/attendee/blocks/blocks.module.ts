import { Module } from '@nestjs/common';
import { OrganisationsModule } from '../../organisations/organisations.module';
import { UsersModule } from '../../users/users.module';
import { AttendeeOrganisationsModule } from '../organisations/attendee-organisations.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [OrganisationsModule, UsersModule, AttendeeOrganisationsModule],
  controllers: [BlocksController],
  providers: [BlocksService],
})
export class BlocksModule {}
