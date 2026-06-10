import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { InterestsController } from './interests.controller';
import { InterestsService } from './interests.service';
import { InterestRules } from './rules/interest.rules';

@Module({
  imports: [UsersModule],
  controllers: [InterestsController],
  providers: [InterestsService, InterestRules],
  exports: [InterestsService, InterestRules],
})
export class InterestsModule {}
