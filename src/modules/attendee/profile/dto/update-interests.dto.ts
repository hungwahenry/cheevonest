import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';
import { toIntArray } from '../../../../common/validation/transforms';

export class UpdateInterestsDto {
  @Transform(toIntArray)
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  interests!: number[];
}
