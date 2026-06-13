import { IsIn, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '12mo'])
  range?: string;
}
