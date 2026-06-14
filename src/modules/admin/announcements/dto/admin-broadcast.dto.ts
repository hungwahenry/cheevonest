import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';
import type {
  AdminBroadcastKind,
  AdminBroadcastStatus,
  UserRole,
} from '../../../../generated/prisma/client';
import type { NotificationChannel } from '../../../notifications/notification-types';
import type { SegmentDefinition } from '../services/audience-segment.service';

const ROLES = ['attendee', 'organiser', 'admin'];
const CHANNELS = ['email', 'push', 'inapp'];

export class SegmentDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(26, 26, { each: true })
  user_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(ROLES, { each: true })
  roles?: UserRole[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  interest_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @IsOptional()
  @IsBoolean()
  has_ordered?: boolean;

  @IsOptional()
  @IsDateString()
  active_since?: string;

  @IsOptional()
  @IsDateString()
  inactive_since?: string;

  @IsOptional()
  @IsBoolean()
  has_upcoming_rsvp?: boolean;
}

export function toSegment(dto: SegmentDto): SegmentDefinition {
  return {
    userIds: dto.user_ids,
    roles: dto.roles,
    interestIds: dto.interest_ids,
    cities: dto.cities,
    hasOrdered: dto.has_ordered,
    activeSince: dto.active_since,
    inactiveSince: dto.inactive_since,
    hasUpcomingRsvp: dto.has_upcoming_rsvp,
  };
}

export class CreateBroadcastDto {
  @IsIn(['system', 'marketing'])
  kind!: AdminBroadcastKind;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(CHANNELS, { each: true })
  channels!: NotificationChannel[];

  @ValidateNested()
  @Type(() => SegmentDto)
  audience!: SegmentDto;
}

export class UpdateBroadcastDto extends CreateBroadcastDto {}

export class PreviewBroadcastDto {
  @IsIn(['system', 'marketing'])
  kind!: AdminBroadcastKind;

  @ValidateNested()
  @Type(() => SegmentDto)
  audience!: SegmentDto;
}

export class ScheduleBroadcastDto {
  @IsDateString()
  scheduled_at!: string;
}

export class ListBroadcastsDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  per_page?: number;

  @IsOptional()
  @IsIn(['system', 'marketing'])
  kind?: AdminBroadcastKind;

  @IsOptional()
  @IsIn(['draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'])
  status?: AdminBroadcastStatus;
}
