import { Controller, Get } from '@nestjs/common';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { InterestsService } from './interests.service';

@Controller('interests')
export class InterestsController {
  constructor(
    private readonly interests: InterestsService,
    private readonly serializer: UserSerializer,
  ) {}

  @Get()
  async list(): Promise<unknown[]> {
    const interests = await this.interests.listActive();

    return interests.map((interest) => this.serializer.interest(interest));
  }
}
