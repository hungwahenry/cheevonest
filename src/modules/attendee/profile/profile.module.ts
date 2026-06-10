import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { InterestsModule } from '../interests/interests.module';
import { ProfileController } from './profile.controller';
import { DataExportService } from './data-export.service';
import { ProfileService } from './profile.service';

@Module({
  imports: [UsersModule, InterestsModule],
  controllers: [ProfileController],
  providers: [ProfileService, DataExportService],
})
export class ProfileModule {}
