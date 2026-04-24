import { IsNotEmpty, IsString } from 'class-validator';

export class RejectRequestDto {
  @IsString()
  @IsNotEmpty()
  managerId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

