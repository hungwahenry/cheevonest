import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { EventsService } from '../../events/events.service';
import {
  ListInboxDto,
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
  UpdatePreferencesDto,
  UpdateQuietHoursDto,
} from '../dto/notifications.dto';
import { NotificationChannel, NotificationType } from '../notification-types';
import { NotificationSerializer } from '../serializers/notification.serializer';
import { InboxService } from '../services/inbox.service';
import { MutesService } from '../services/mutes.service';
import { NotificationPreferencesService } from '../services/notification-preferences.service';
import { PushTokensService } from '../services/push-tokens.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly inbox: InboxService,
    private readonly preferences: NotificationPreferencesService,
    private readonly pushTokens: PushTokensService,
    private readonly mutes: MutesService,
    private readonly events: EventsService,
    private readonly serializer: NotificationSerializer,
  ) {}

  @Get()
  async list(
    @Query() dto: ListInboxDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = 20;

    const result = await this.inbox.page(user.id, page, perPage);

    return new Paginated(
      result.items.map((notification) =>
        this.serializer.inboxItem(notification),
      ),
      page,
      perPage,
      result.total,
    );
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: User): Promise<unknown> {
    return { unread: await this.inbox.unreadCount(user.id) };
  }

  @Patch('read-all')
  async readAll(@CurrentUser() user: User): Promise<ApiResult<null>> {
    await this.inbox.markAllRead(user.id);

    return new ApiResult(null);
  }

  @Patch(':notificationId/read')
  async read(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    await this.inbox.markRead(user.id, notificationId);

    return new ApiResult(null);
  }

  @Get('preferences')
  async showPreferences(@CurrentUser() user: User): Promise<unknown> {
    return this.serializer.preferences(
      user,
      await this.preferences.matrix(user.id),
    );
  }

  @Patch('preferences')
  async updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    for (const row of dto.preferences) {
      await this.preferences.set(
        user.id,
        row.type as NotificationType,
        row.channel as NotificationChannel,
        row.enabled,
      );
    }

    return new ApiResult(null, 'Preferences saved.');
  }

  @Patch('quiet-hours')
  async updateQuietHours(
    @Body() dto: UpdateQuietHoursDto,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const updated = await this.preferences.updateQuietHours(user, {
      start: dto.start ?? null,
      end: dto.end ?? null,
      timezone: dto.timezone ?? null,
    });

    return this.serializer.preferences(
      updated,
      await this.preferences.matrix(updated.id),
    );
  }

  @Post('events/:eventId/mute')
  @HttpCode(200)
  async toggleMute(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);

    return { muted: await this.mutes.toggle(user.id, event.id) };
  }

  @Post('push-tokens')
  @HttpCode(200)
  async registerToken(
    @Body() dto: RegisterPushTokenDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    await this.pushTokens.register(user.id, dto.token, dto.device_id ?? null);

    return new ApiResult(null, 'Push token registered.');
  }

  @Delete('push-tokens')
  @HttpCode(200)
  async unregisterToken(
    @Body() dto: UnregisterPushTokenDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    await this.pushTokens.unregister(user.id, dto.token);

    return new ApiResult(null, 'Push token unregistered.');
  }
}
