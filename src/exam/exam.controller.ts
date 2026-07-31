import { Controller, Get, Post, Body, Param, Req, UseGuards, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
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

  private async resolveUser(uid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Get()
  async findAll(@Req() req: any) {
    const user = await this.resolveUser(req.user.uid);
    return this.examService.findAll(user.id);
  }

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Get(':id/status')
  async getStatus(@Param('id', ParseUUIDPipe) examId: string, @Req() req: any) {
    const user = await this.resolveUser(req.user.uid);
    return this.examService.getStatus(examId, user.id);
  }

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Post(':id/submit')
  async submit(
    @Param('id', ParseUUIDPipe) examId: string,
    @Body() dto: SubmitExamDto,
    @Req() req: any,
  ) {
    const user = await this.resolveUser(req.user.uid);
    return this.examService.submit(examId, user.id, dto);
  }
}
