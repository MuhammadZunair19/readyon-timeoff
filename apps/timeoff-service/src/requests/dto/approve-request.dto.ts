import { IsNotEmpty, IsString } from 'class-validator';

export class ApproveRequestDto {
  @IsString()
  @IsNotEmpty()
  managerId!: string;
}

