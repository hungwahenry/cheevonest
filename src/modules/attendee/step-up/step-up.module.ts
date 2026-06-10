import { Module } from '@nestjs/common';
import { MailModule } from '../../../integrations/mail/mail.module';
import { UsersModule } from '../../users/users.module';
import { ChangeEmailAction } from './actions/change-email.action';
import { DeleteAccountAction } from './actions/delete-account.action';
import { StepUpController } from './step-up.controller';
import { StepUpSerializer } from './step-up.serializer';
import { StepUpService } from './services/step-up.service';

@Module({
  imports: [MailModule, UsersModule],
  controllers: [StepUpController],
  providers: [
    StepUpService,
    StepUpSerializer,
    ChangeEmailAction,
    DeleteAccountAction,
  ],
})
export class StepUpModule {}
