import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsString()
  @MinLength(1)
  workplace: string;

  @IsString()
  @MinLength(1)
  medicalArea: string;

  @IsString()
  @MinLength(1)
  phoneNumber: string;

  @IsString()
  @MinLength(1)
  city: string;
}
