import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { toNumber } from '../../../../common/validation/transforms';

export class OrderItemDto {
  @IsString()
  ticket_id!: string;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

export class QuoteOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class CreateOrderDto extends QuoteOrderDto {
  @IsString()
  @MaxLength(500)
  @Matches(/^(?:https|cheevo):\/\//i, {
    message: 'The callback_url must be an https or app-scheme URL.',
  })
  callback_url!: string;

  @IsOptional()
  @IsIn(['paystack'])
  provider?: string | null;
}

export class VerifyOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  lookup_key?: string | null;
}
