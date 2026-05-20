import { Controller, Get, Post, Body, Param, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ExamService } from './exam.service.js';
import { SubmitExamDto } from './dto/submit-exam.dto.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('exams')
@Controller('exams')
export class ExamController {
  constructor(
    private examService: ExamService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Get()
  async findAll(@Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: req.user.uid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.examService.findAll(user.id);
  }

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Post(':id/submit')
  async submit(@Param('id') examId: string, @Body() dto: SubmitExamDto, @Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: req.user.uid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.examService.submit(examId, user.id, dto);
  }
}
