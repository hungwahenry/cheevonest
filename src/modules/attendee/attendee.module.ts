import { Module } from '@nestjs/common';
import { InterestsModule } from './interests/interests.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [InterestsModule, OnboardingModule, ProfileModule],
})
export class AttendeeModule {}
