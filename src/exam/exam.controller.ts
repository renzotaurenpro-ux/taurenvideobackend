import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { ExamService } from './exam.service.js';
import { SubmitExamDto } from './dto/submit-exam.dto.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('exams')
export class ExamController {
  constructor(
    private examService: ExamService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  findAllAdmin() {
    return this.examService.findAllAdmin();
  }

  @UseGuards(FirebaseAuthGuard)
  @Get()
  async findAll(@Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: req.user.uid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.examService.findAll(user.id);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: req.user.uid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.examService.findOne(id, user.id);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post(':id/submit')
  async submit(@Param('id') examId: string, @Body() dto: SubmitExamDto, @Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: req.user.uid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.examService.submit(examId, user.id, dto);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.examService.remove(id);
  }
}
