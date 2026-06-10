import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { InterestsModule } from '../interests/interests.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [UsersModule, InterestsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
