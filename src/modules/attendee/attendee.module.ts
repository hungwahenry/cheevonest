import { Module } from '@nestjs/common';
import { BlocksModule } from './blocks/blocks.module';
import { AttendeeEventsModule } from './events/attendee-events.module';
import { FeedModule } from './feed/feed.module';
import { InterestsModule } from './interests/interests.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AttendeeOrganisationsModule } from './organisations/attendee-organisations.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    InterestsModule,
    OnboardingModule,
    ProfileModule,
    FeedModule,
    AttendeeEventsModule,
    AttendeeOrganisationsModule,
    BlocksModule,
  ],
})
export class AttendeeModule {}
