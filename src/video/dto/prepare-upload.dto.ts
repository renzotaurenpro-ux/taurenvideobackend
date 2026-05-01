import { IsString, IsInt, IsOptional, IsBoolean, MinLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class PrepareUploadDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  priceClp: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  published?: boolean;
}
