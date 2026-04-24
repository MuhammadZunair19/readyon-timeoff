import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsObject, IsString } from 'class-validator';

export class HcmEventDto {
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

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

