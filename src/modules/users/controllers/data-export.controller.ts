import { Controller, Get } from '@nestjs/common';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { DataExportService } from '../services/data-export.service';

@Controller('data-export')
export class DataExportController {
  constructor(private readonly dataExport: DataExportService) {}

  @Get()
  async show(@CurrentUser() user: User): Promise<unknown> {
    return this.dataExport.build(user);
  }
}
