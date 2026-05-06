import { Controller, Post, Get, Param, Body, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { CertificateService } from './certificate.service.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IsString } from 'class-validator';

class IssueDto {
  @IsString()
  examId: string;
}

@Controller('certificates')
export class CertificateController {
  constructor(
    private certificateService: CertificateService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(FirebaseAuthGuard)
  @Post('issue')
  async issue(@Req() req: any, @Body() body: IssueDto) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: req.user.uid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.certificateService.issue(user.id, body.examId);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('my')
  async getMy(@Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: req.user.uid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.certificateService.getMyCertificates(user.id);
  }

  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.certificateService.verify(code);
  }
}
