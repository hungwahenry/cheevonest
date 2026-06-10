import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganisationsService } from './organisations.service';

/** Failed checks render as 404 so outsiders can't probe organisation ids. */
@Injectable()
export class OrganisationsPolicy {
  constructor(private readonly organisations: OrganisationsService) {}

  async assertView(organisationId: string, userId: string): Promise<void> {
    if (!(await this.organisations.hasMember(organisationId, userId))) {
      throw new NotFoundException();
    }
  }

  async assertManage(organisationId: string, userId: string): Promise<void> {
    const role = await this.organisations.roleOf(organisationId, userId);

    if (role !== 'owner') {
      throw new NotFoundException();
    }
  }

  async assertManageMembers(
    organisationId: string,
    userId: string,
  ): Promise<void> {
    return this.assertManage(organisationId, userId);
  }
}
