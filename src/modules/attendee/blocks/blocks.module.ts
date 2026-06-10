import { Module } from '@nestjs/common';
import { OrganisationsModule } from '../../organisations/organisations.module';
import { UsersModule } from '../../users/users.module';
import { AttendeeOrganisationsModule } from '../organisations/attendee-organisations.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { BlockRules } from './rules/block.rules';

@Module({
  imports: [OrganisationsModule, UsersModule, AttendeeOrganisationsModule],
  controllers: [BlocksController],
  providers: [BlocksService, BlockRules],
})
export class BlocksModule {}
