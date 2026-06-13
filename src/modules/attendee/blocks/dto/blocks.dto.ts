import { IsIn, IsString, Length } from 'class-validator';
import { BLOCKABLE_TYPES } from '../blocks.service';

export class CreateBlockDto {
  @IsString()
  @IsIn(BLOCKABLE_TYPES)
  target_type!: string;

  @IsString()
  @Length(26, 26)
  target_id!: string;
}
