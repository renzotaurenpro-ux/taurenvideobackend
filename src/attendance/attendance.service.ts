import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';
import { ImportAttendeeDto, SubmitAttendanceExamDto } from './dto/attendance.dto.js';

const EVENT = {
  organization: 'SOCIEDAD CHILENA DE ALERGIA E INMUNOLOGÍA',
  type: 'CERTIFICADO DE ASISTENCIA',
  eventTitle: 'III Jornadas Regionales de Inmunología Clínica',
  eventSubtitle: 'Cuando el Sistema Inmune Falla: Desafíos en Errores Innatos de la Inmunidad',
  eventDate: '19 de junio de 2026',
  modality: 'online',
  director1: 'Dra. Rocío Tordecilla Fernández',
  director1Role: 'Directora Sociedad Chilena de Alergía e Inmunología',
  director2: 'Dra. Ligia Rodríguez Alvarez',
  director2Role: 'Directora de Redes Sociales y Regional de SCAI',
};

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private formatCertificate(eligibility: {
    firstName: string;
    lastName: string;
    email: string;
    certificate: { certificateCode: string; issuedAt: Date } | null;
  }) {
    if (!eligibility.certificate) return null;
    return {
      certificateCode: eligibility.certificate.certificateCode,
      issuedAt: eligibility.certificate.issuedAt,
      recipient: {
        firstName: eligibility.firstName,
        lastName: eligibility.lastName,
        fullName: `${eligibility.firstName} ${eligibility.lastName}`.trim(),
        email: eligibility.email,
      },
      event: EVENT,
    };
  }

  private async findEligibilityByEmail(email: string) {
    return this.prisma.attendanceEligibility.findFirst({
      where: { email: { equals: this.normalizeEmail(email), mode: 'insensitive' } },
      include: { certificate: true, examAttempts: true },
    });
  }

  private async getPublishedEventExam() {
    const exam = await this.prisma.exam.findFirst({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!exam) throw new NotFoundException('Examen del evento no disponible');
    return exam;
  }

  private async assertCanTakeAttendanceExam(email: string) {
    const eligibility = await this.findEligibilityByEmail(email);
    if (!eligibility) {
      throw new NotFoundException('No encontramos tu correo en la lista de asistentes del evento');
    }
    if (eligibility.watchedOver80) {
      throw new ForbiddenException(
        'Calificas por asistencia directa. Usa /attendance/claim con tu correo',
      );
    }
    if (eligibility.certificate) {
      throw new BadRequestException('Ya obtuviste tu certificado de asistencia');
    }
    const passedAttempt = eligibility.examAttempts.find((a) => a.passed);
    if (passedAttempt) {
      throw new BadRequestException('Ya aprobaste el test. Reclama tu certificado con /attendance/claim');
    }
    return eligibility;
  }

  private async issueCertificate(eligibilityId: string) {
    const certificateCode = randomBytes(16).toString('hex').toUpperCase();
    await this.prisma.attendanceCertificate.create({
      data: { eligibilityId, certificateCode },
    });
    return this.prisma.attendanceEligibility.findUnique({
      where: { id: eligibilityId },
      include: { certificate: true },
    });
  }

  async importAttendees(attendees: ImportAttendeeDto[]) {
    let created = 0;
    let updated = 0;

    for (const a of attendees) {
      const email = this.normalizeEmail(a.email);
      const existing = await this.prisma.attendanceEligibility.findUnique({ where: { email } });

      if (existing) {
        await this.prisma.attendanceEligibility.update({
          where: { email },
          data: {
            firstName: a.firstName,
            lastName: a.lastName,
            watchedOver80: a.watchedOver80,
          },
        });
        updated++;
      } else {
        await this.prisma.attendanceEligibility.create({
          data: {
            email,
            firstName: a.firstName,
            lastName: a.lastName,
            watchedOver80: a.watchedOver80,
          },
        });
        created++;
      }
    }

    return { created, updated, total: attendees.length };
  }

  async findAllAdmin() {
    return this.prisma.attendanceEligibility.findMany({
      include: {
        certificate: { select: { certificateCode: true, issuedAt: true } },
        examAttempts: { select: { score: true, passed: true, submittedAt: true } },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async claim(email: string) {
    const eligibility = await this.findEligibilityByEmail(email);

    if (!eligibility) {
      return {
        status: 'NOT_FOUND',
        message: 'No encontramos tu correo en la lista de asistentes del evento.',
        canTakeExam: false,
        certificate: null,
      };
    }

    if (eligibility.certificate) {
      return {
        status: 'ALREADY_ISSUED',
        message: 'Ya obtuviste tu certificado de asistencia.',
        canTakeExam: false,
        certificate: this.formatCertificate(eligibility),
      };
    }

    if (!eligibility.watchedOver80) {
      const passedAttempt = eligibility.examAttempts.find((a) => a.passed);
      if (!passedAttempt) {
        return {
          status: 'NOT_ELIGIBLE',
          message:
            'No alcanzaste el 80% de visualización. Realiza el test con tu correo para obtener tu certificado de asistencia.',
          canTakeExam: true,
          certificate: null,
        };
      }

      const issued = await this.issueCertificate(eligibility.id);
      return {
        status: 'CERTIFICATE_ISSUED',
        message: 'Obtuviste tu certificado de asistencia por aprobar el test del evento.',
        canTakeExam: false,
        certificate: this.formatCertificate(issued!),
      };
    }

    const issued = await this.issueCertificate(eligibility.id);
    return {
      status: 'CERTIFICATE_ISSUED',
      message: 'Obtuviste tu certificado de asistencia por haber visto más del 80% del evento.',
      canTakeExam: false,
      certificate: this.formatCertificate(issued!),
    };
  }

  async getExam(email: string) {
    await this.assertCanTakeAttendanceExam(email);
    const exam = await this.getPublishedEventExam();

    return this.prisma.exam.findUnique({
      where: { id: exam.id },
      select: {
        id: true,
        title: true,
        passingScore: true,
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            text: true,
            order: true,
            options: { select: { id: true, text: true } },
          },
        },
      },
    });
  }

  async submitExam(dto: SubmitAttendanceExamDto) {
    const eligibility = await this.assertCanTakeAttendanceExam(dto.email);
    const exam = await this.prisma.exam.findFirst({
      where: { published: true },
      include: { questions: { include: { options: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!exam) throw new NotFoundException('Examen no encontrado');

    const total = exam.questions.length;
    if (total === 0) throw new BadRequestException('El examen no tiene preguntas');

    let correct = 0;
    for (const question of exam.questions) {
      const answer = dto.answers.find((a) => a.questionId === question.id);
      if (!answer) continue;
      const selected = question.options.find((o) => o.id === answer.optionId);
      if (selected?.isCorrect) correct++;
    }

    const notaExacta = 1 + (correct / total) * 6;
    const nota = Math.round(notaExacta * 10) / 10;
    const passed = nota >= 5.0;
    const score = Math.round((correct / total) * 100);

    await this.prisma.attendanceExamAttempt.upsert({
      where: {
        eligibilityId_examId: { eligibilityId: eligibility.id, examId: exam.id },
      },
      create: {
        eligibilityId: eligibility.id,
        examId: exam.id,
        score,
        passed,
      },
      update: { score, passed, submittedAt: new Date() },
    });

    if (!passed) {
      return {
        status: 'FAILED',
        message: 'No alcanzaste la nota mínima. Puedes intentar nuevamente.',
        correctas: correct,
        total,
        nota,
        notaMaxima: 7,
        notaAprobacion: 5,
        passed: false,
        certificate: null,
      };
    }

    const issued = await this.issueCertificate(eligibility.id);

    return {
      status: 'CERTIFICATE_ISSUED',
      message: 'Aprobaste el test. Tu certificado de asistencia ha sido emitido.',
      correctas: correct,
      total,
      nota,
      notaMaxima: 7,
      notaAprobacion: 5,
      passed: true,
      certificate: this.formatCertificate(issued!),
    };
  }

  async verify(certificateCode: string) {
    const cert = await this.prisma.attendanceCertificate.findUnique({
      where: { certificateCode: certificateCode.toUpperCase() },
      include: { eligibility: true },
    });

    if (!cert) {
      return { valid: false, type: 'ATTENDANCE' };
    }

    return {
      valid: true,
      type: 'ATTENDANCE',
      certificateCode: cert.certificateCode,
      issuedAt: cert.issuedAt,
      recipient: {
        firstName: cert.eligibility.firstName,
        lastName: cert.eligibility.lastName,
        fullName: `${cert.eligibility.firstName} ${cert.eligibility.lastName}`.trim(),
        email: cert.eligibility.email,
      },
      event: EVENT,
    };
  }
}
