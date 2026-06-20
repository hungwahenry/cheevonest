import { IsString, Length } from 'class-validator';

export class TransferTicketDto {
  @IsString()
  @Length(26, 26)
  to_user_id!: string;
}
