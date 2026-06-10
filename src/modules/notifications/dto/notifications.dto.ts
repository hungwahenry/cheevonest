import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { toBoolean, toNumber } from '../../../common/validation/transforms';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPE_VALUES,
} from '../notification-types';

export class ListInboxDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
}

export class PreferenceRowDto {
  @IsIn(NOTIFICATION_TYPE_VALUES)
  type!: string;

  @IsIn(NOTIFICATION_CHANNELS)
  channel!: string;

  @Transform(toBoolean)
  @IsBoolean()
  enabled!: boolean;
}

export class UpdatePreferencesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreferenceRowDto)
  preferences!: PreferenceRowDto[];
}

const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

export class UpdateQuietHoursDto {
  @ValidateIf((dto: UpdateQuietHoursDto) => dto.end != null)
  @IsString()
  @Matches(TIME_PATTERN, { message: 'The start must be a HH:MM time.' })
  start?: string | null;

  @ValidateIf((dto: UpdateQuietHoursDto) => dto.start != null)
  @IsString()
  @Matches(TIME_PATTERN, { message: 'The end must be a HH:MM time.' })
  end?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string | null;
}

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^Expo(nent)?PushToken\[/, {
    message: 'The token must be an Expo push token.',
  })
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  device_id?: string | null;
}

export class UnregisterPushTokenDto {
  @IsString()
  @MaxLength(255)
  token!: string;
}
