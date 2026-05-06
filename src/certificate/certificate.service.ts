import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';

@Injectable()
export class CertificateService {
  constructor(private prisma: PrismaService) {}

  async issue(userId: string, examId: string) {
    const passed = await this.prisma.examAttempt.findFirst({
      where: { userId, examId, passed: true },
    });

    if (!passed) {
      throw new BadRequestException('Debes aprobar el examen para obtener el certificado');
    }

    const existing = await this.prisma.certificate.findUnique({
      where: { userId_examId: { userId, examId } },
    });

    if (existing) return existing;

    const certificateCode = randomBytes(16).toString('hex').toUpperCase();

    return this.prisma.certificate.create({
      data: { userId, examId, certificateCode },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        exam: { select: { title: true } },
      },
    });
  }

  async verify(certificateCode: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { certificateCode },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        exam: { select: { title: true, videoId: true } },
      },
    });

    if (!certificate) {
      return { valid: false };
    }

    return {
      valid: true,
      certificateCode: certificate.certificateCode,
      issuedAt: certificate.issuedAt,
      user: certificate.user,
      exam: certificate.exam,
    };
  }

  async getMyCertificates(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId },
      include: {
        exam: { select: { title: true, videoId: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
