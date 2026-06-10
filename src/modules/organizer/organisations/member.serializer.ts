import { Injectable } from '@nestjs/common';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { MemberForResource } from './members.service';

@Injectable()
export class MemberSerializer {
  constructor(private readonly users: UserSerializer) {}

  member(membership: MemberForResource): Record<string, unknown> {
    return {
      id: membership.user.id,
      email: membership.user.email,
      role: membership.role,
      joined_at: membership.createdAt.toISOString(),
      profile: {
        first_name: membership.user.profile?.firstName ?? null,
        last_name: membership.user.profile?.lastName ?? null,
        avatar_url: membership.user.profile
          ? this.users.avatarUrl(membership.user.profile)
          : null,
      },
    };
  }
}
