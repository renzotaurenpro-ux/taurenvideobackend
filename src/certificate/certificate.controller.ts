import { Controller, Post, Get, Param, Body, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CertificateService } from './certificate.service.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IsString, IsUUID } from 'class-validator';

class IssueDto {
  @IsUUID()
  @IsString()
  examId: string;
}

@ApiTags('certificates')
@Controller('certificates')
export class CertificateController {
  constructor(
    private certificateService: CertificateService,
    private prisma: PrismaService,
  ) {}

  private async resolveUser(uid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Post('issue')
  async issue(@Req() req: any, @Body() body: IssueDto) {
    const user = await this.resolveUser(req.user.uid);
    return this.certificateService.issue(user.id, body.examId);
  }

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Get('my')
  async getMy(@Req() req: any) {
    const user = await this.resolveUser(req.user.uid);
    return this.certificateService.getMyCertificates(user.id);
  }

  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.certificateService.verify(code);
  }
}
