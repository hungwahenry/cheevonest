import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { BankResolverService } from '../../payouts/services/bank-resolver.service';
import { ResolveBankAccountDto } from './dto/payouts.dto';

@Controller('organizer/payouts')
export class BanksController {
  constructor(private readonly resolver: BankResolverService) {}

  @Get('banks')
  async banks(): Promise<unknown> {
    return this.resolver.banks();
  }

  @Post('resolve')
  @HttpCode(200)
  async resolve(@Body() dto: ResolveBankAccountDto): Promise<unknown> {
    return this.resolver.resolve(dto.account_number, dto.bank_code);
  }
}
