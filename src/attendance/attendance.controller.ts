import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service.js';
import {
  BulkImportDto,
  AttendanceEmailDto,
  SubmitAttendanceExamDto,
} from './dto/attendance.dto.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('status')
  status(@Body() dto: AttendanceEmailDto) {
    return this.attendanceService.status(dto.email);
  }

  @Post('claim/viewing')
  claimViewing(@Body() dto: AttendanceEmailDto) {
    return this.attendanceService.claimViewing(dto.email);
  }

  @Post('claim/exam')
  claimExam(@Body() dto: AttendanceEmailDto) {
    return this.attendanceService.claimExam(dto.email);
  }

  @Post('exam')
  getExam(@Body() dto: AttendanceEmailDto) {
    return this.attendanceService.getExam(dto.email);
  }

  @Post('exam/submit')
  submitExam(@Body() dto: SubmitAttendanceExamDto) {
    return this.attendanceService.submitExam(dto);
  }

  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.attendanceService.verify(code);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('admin/import')
  import(@Body() dto: BulkImportDto) {
    return this.attendanceService.importAttendees(dto.attendees);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('admin/all')
  findAllAdmin() {
    return this.attendanceService.findAllAdmin();
  }
}
