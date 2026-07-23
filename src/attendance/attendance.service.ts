import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';
import { ImportAttendeeDto, SubmitAttendanceExamDto } from './dto/attendance.dto.js';
import { AttendanceCertificateType } from '../../generated/prisma/client.js';

export const VIEWING_THRESHOLD_PERCENT = 50;

const EVENT_BASE = {
  organization: 'SOCIEDAD CHILENA DE ALERGIA E INMUNOLOGÍA',
  eventTitle: 'III Jornadas Regionales de Inmunología Clínica',
  eventSubtitle: 'Cuando el Sistema Inmune Falla: Desafíos en Errores Innatos de la Inmunidad',
  eventDate: '19 de junio de 2026',
  modality: 'online',
  director1: 'Dra. Rocío Tordecilla Fernández',
  director1Role: 'Directora Sociedad Chilena de Alergía e Inmunología',
  director2: 'Dra. Ligia Rodríguez Alvarez',
  director2Role: 'Directora de Redes Sociales y Regional de SCAI',
};

const CERTIFICATE_META: Record<
  AttendanceCertificateType,
  { type: string; label: string; title: string }
> = {
  LIVE_VIEWING: {
    type: 'LIVE_VIEWING',
    label: 'CERTIFICADO DE ASISTENCIA AL EVENTO EN VIVO',
    title: 'Certificado de Asistencia al Evento en Vivo',
  },
  EXAM: {
    type: 'EXAM',
    label: 'CERTIFICADO DE EXAMEN DEL EVENTO',
    title: 'Certificado de Examen del Evento',
  },
};

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getCertificate(
    certificates: { type: AttendanceCertificateType; certificateCode: string; issuedAt: Date }[],
    type: AttendanceCertificateType,
  ) {
    return certificates.find((c) => c.type === type) ?? null;
  }

  private formatCertificate(
    eligibility: { firstName: string; lastName: string; email: string },
    cert: { type: AttendanceCertificateType; certificateCode: string; issuedAt: Date },
  ) {
    const meta = CERTIFICATE_META[cert.type];
    return {
      certificateType: meta.type,
      certificateLabel: meta.label,
      certificateTitle: meta.title,
      certificateCode: cert.certificateCode,
      issuedAt: cert.issuedAt,
      recipient: {
        firstName: eligibility.firstName,
        lastName: eligibility.lastName,
        fullName: `${eligibility.firstName} ${eligibility.lastName}`.trim(),
        email: eligibility.email,
      },
      event: { ...EVENT_BASE, type: meta.label },
    };
  }

  private buildStatus(
    eligibility: {
      firstName: string;
      lastName: string;
      email: string;
      watchedOver50: boolean;
      certificates: { type: AttendanceCertificateType; certificateCode: string; issuedAt: Date }[];
      examAttempts: { passed: boolean }[];
    },
    registered = true,
  ) {
    const viewingCertificate = this.getCertificate(eligibility.certificates, 'LIVE_VIEWING');
    const examCertificate = this.getCertificate(eligibility.certificates, 'EXAM');
    const passedExam = eligibility.examAttempts.some((a) => a.passed);

    const canClaimViewing = registered && eligibility.watchedOver50 && !viewingCertificate;
    const canTakeExam = registered && !examCertificate && !passedExam;
    const canOnlyTakeExam = registered && !eligibility.watchedOver50;

    return {
      viewingThresholdPercent: VIEWING_THRESHOLD_PERCENT,
      watchedOver50: eligibility.watchedOver50,
      canClaimViewing,
      canTakeExam,
      canOnlyTakeExam,
      viewingCertificate: viewingCertificate
        ? this.formatCertificate(eligibility, viewingCertificate)
        : null,
      examCertificate: examCertificate
        ? this.formatCertificate(eligibility, examCertificate)
        : null,
    };
  }

  private async findEligibilityByEmail(email: string) {
    return this.prisma.attendanceEligibility.findFirst({
      where: { email: { equals: this.normalizeEmail(email), mode: 'insensitive' } },
      include: { certificates: true, examAttempts: true },
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
    if (this.getCertificate(eligibility.certificates, 'EXAM')) {
      throw new BadRequestException('Ya obtuviste tu certificado de examen del evento');
    }
    if (eligibility.examAttempts.some((a) => a.passed)) {
      throw new BadRequestException('Ya aprobaste el examen. Reclama tu certificado con POST /attendance/claim/exam');
    }
    return eligibility;
  }

  private async issueCertificate(eligibilityId: string, type: AttendanceCertificateType) {
    const existing = await this.prisma.attendanceCertificate.findUnique({
      where: { eligibilityId_type: { eligibilityId, type } },
    });
    if (existing) {
      return this.prisma.attendanceEligibility.findUnique({
        where: { id: eligibilityId },
        include: { certificates: true },
      });
    }

    const certificateCode = randomBytes(16).toString('hex').toUpperCase();
    await this.prisma.attendanceCertificate.create({
      data: { eligibilityId, type, certificateCode },
    });

    return this.prisma.attendanceEligibility.findUnique({
      where: { id: eligibilityId },
      include: { certificates: true },
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
            watchedOver50: a.watchedOver50,
          },
        });
        updated++;
      } else {
        await this.prisma.attendanceEligibility.create({
          data: {
            email,
            firstName: a.firstName,
            lastName: a.lastName,
            watchedOver50: a.watchedOver50,
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
        certificates: { select: { type: true, certificateCode: true, issuedAt: true } },
        examAttempts: { select: { score: true, passed: true, submittedAt: true } },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async status(email: string) {
    const eligibility = await this.findEligibilityByEmail(email);

    if (!eligibility) {
      return {
        status: 'NOT_FOUND',
        message: 'No encontramos tu correo en la lista de asistentes del evento.',
        ...this.buildStatus(
          {
            firstName: '',
            lastName: '',
            email,
            watchedOver50: false,
            certificates: [],
            examAttempts: [],
          },
          false,
        ),
      };
    }

    const state = this.buildStatus(eligibility);

    return {
      status: 'OK',
      message: 'Estado de certificados del evento en vivo.',
      recipient: {
        firstName: eligibility.firstName,
        lastName: eligibility.lastName,
        fullName: `${eligibility.firstName} ${eligibility.lastName}`.trim(),
        email: eligibility.email,
      },
      ...state,
    };
  }

  async claimViewing(email: string) {
    const eligibility = await this.findEligibilityByEmail(email);

    if (!eligibility) {
      return {
        status: 'NOT_FOUND',
        message: 'No encontramos tu correo en la lista de asistentes del evento.',
        certificate: null,
        ...this.buildStatus(
          {
            firstName: '',
            lastName: '',
            email,
            watchedOver50: false,
            certificates: [],
            examAttempts: [],
          },
          false,
        ),
      };
    }

    const state = this.buildStatus(eligibility);

    if (!eligibility.watchedOver50) {
      return {
        status: 'NOT_ELIGIBLE',
        message:
          `No alcanzaste el ${VIEWING_THRESHOLD_PERCENT}% de visualización del evento en vivo. Puedes obtener el certificado de examen del evento.`,
        certificate: null,
        ...state,
      };
    }

    if (state.viewingCertificate) {
      return {
        status: 'ALREADY_ISSUED',
        message: 'Ya obtuviste tu certificado de asistencia al evento en vivo.',
        certificate: state.viewingCertificate,
        ...state,
      };
    }

    const issued = await this.issueCertificate(eligibility.id, 'LIVE_VIEWING');
    const viewingCertificate = this.formatCertificate(
      issued!,
      this.getCertificate(issued!.certificates, 'LIVE_VIEWING')!,
    );
    const updatedState = this.buildStatus({ ...issued!, examAttempts: eligibility.examAttempts });

    return {
      status: 'CERTIFICATE_ISSUED',
      message: 'Obtuviste tu certificado de asistencia al evento en vivo.',
      certificate: viewingCertificate,
      ...updatedState,
    };
  }

  async claimExam(email: string) {
    const eligibility = await this.findEligibilityByEmail(email);

    if (!eligibility) {
      return {
        status: 'NOT_FOUND',
        message: 'No encontramos tu correo en la lista de asistentes del evento.',
        certificate: null,
        ...this.buildStatus(
          {
            firstName: '',
            lastName: '',
            email,
            watchedOver50: false,
            certificates: [],
            examAttempts: [],
          },
          false,
        ),
      };
    }

    const state = this.buildStatus(eligibility);

    if (state.examCertificate) {
      return {
        status: 'ALREADY_ISSUED',
        message: 'Ya obtuviste tu certificado de examen del evento.',
        certificate: state.examCertificate,
        ...state,
      };
    }

    const passedAttempt = eligibility.examAttempts.find((a) => a.passed);
    if (!passedAttempt) {
      return {
        status: 'NOT_ELIGIBLE',
        message: 'Debes aprobar el examen del evento para obtener el certificado de examen.',
        certificate: null,
        ...state,
      };
    }

    const issued = await this.issueCertificate(eligibility.id, 'EXAM');
    const examCertificate = this.formatCertificate(
      issued!,
      this.getCertificate(issued!.certificates, 'EXAM')!,
    );
    const updatedState = this.buildStatus({ ...issued!, examAttempts: eligibility.examAttempts });

    return {
      status: 'CERTIFICATE_ISSUED',
      message: 'Obtuviste tu certificado de examen del evento.',
      certificate: examCertificate,
      ...updatedState,
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
    const answerDetails: { questionId: string; optionId: string; correct: boolean }[] = [];
    for (const question of exam.questions) {
      const answer = dto.answers.find((a) => a.questionId === question.id);
      if (!answer) {
        answerDetails.push({ questionId: question.id, optionId: '', correct: false });
        continue;
      }
      const selected = question.options.find((o) => o.id === answer.optionId);
      const isCorrect = !!selected?.isCorrect;
      if (isCorrect) correct++;
      answerDetails.push({ questionId: question.id, optionId: answer.optionId, correct: isCorrect });
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
        answers: answerDetails,
      },
      update: { score, passed, answers: answerDetails, submittedAt: new Date() },
    });

    const state = this.buildStatus({
      ...eligibility,
      examAttempts: [{ passed }, ...eligibility.examAttempts],
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
        ...state,
      };
    }

    const issued = await this.issueCertificate(eligibility.id, 'EXAM');
    const examCertificate = this.formatCertificate(
      issued!,
      this.getCertificate(issued!.certificates, 'EXAM')!,
    );
    const updatedState = this.buildStatus({ ...issued!, examAttempts: [{ passed }] });

    return {
      status: 'CERTIFICATE_ISSUED',
      message: 'Aprobaste el examen. Tu certificado de examen del evento ha sido emitido.',
      correctas: correct,
      total,
      nota,
      notaMaxima: 7,
      notaAprobacion: 5,
      passed: true,
      certificate: examCertificate,
      ...updatedState,
    };
  }

  async verify(certificateCode: string) {
    const cert = await this.prisma.attendanceCertificate.findUnique({
      where: { certificateCode: certificateCode.toUpperCase() },
      include: { eligibility: true },
    });

    if (!cert) {
      return { valid: false };
    }

    const meta = CERTIFICATE_META[cert.type];

    return {
      valid: true,
      certificateType: meta.type,
      certificateLabel: meta.label,
      certificateTitle: meta.title,
      certificateCode: cert.certificateCode,
      issuedAt: cert.issuedAt,
      recipient: {
        firstName: cert.eligibility.firstName,
        lastName: cert.eligibility.lastName,
        fullName: `${cert.eligibility.firstName} ${cert.eligibility.lastName}`.trim(),
        email: cert.eligibility.email,
      },
      event: { ...EVENT_BASE, type: meta.label },
    };
  }
}
