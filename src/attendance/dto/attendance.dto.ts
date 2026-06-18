import { IsEmail, IsString, IsBoolean, IsArray, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ImportAttendeeDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty()
  @IsBoolean()
  watchedOver80: boolean;
}

export class BulkImportDto {
  @ApiProperty({ type: [ImportAttendeeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportAttendeeDto)
  attendees: ImportAttendeeDto[];
}

export class AttendanceEmailDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class AttendanceAnswerDto {
  @ApiProperty()
  @IsString()
  questionId: string;

  @ApiProperty()
  @IsString()
  optionId: string;
}

export class SubmitAttendanceExamDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ type: [AttendanceAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceAnswerDto)
  answers: AttendanceAnswerDto[];
}
