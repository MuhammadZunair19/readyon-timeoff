import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class HcmBalanceDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  leaveType!: string;

  @Type(() => Number)
  @IsNumber()
  totalDays!: number;

  @Type(() => Number)
  @IsNumber()
  usedDays!: number;
}

export class HcmBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HcmBalanceDto)
  balances!: HcmBalanceDto[];
}

