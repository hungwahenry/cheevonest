import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OrderItemDto } from '../../../attendee/orders/dto/order.dto';

const lowercaseTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class GuestQuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class GuestCheckoutDto extends GuestQuoteDto {
  @Transform(lowercaseTrim)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  last_name?: string;

  @IsString()
  @MaxLength(500)
  @Matches(/^https?:\/\//i, {
    message: 'The callback_url must be an http(s) URL.',
  })
  callback_url!: string;

  @IsOptional()
  @IsIn(['paystack', 'flutterwave'])
  provider?: string | null;
}
