import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class YearQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2008) // GitHub's own founding year — nothing valid before this
  @Max(new Date().getUTCFullYear())
  year?: number;
}