import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CertificateService } from '../certificate/certificate.service.js';
import { SubmitExamDto } from './dto/submit-exam.dto.js';

@Injectable()
export class ExamService {
  constructor(
    private prisma: PrismaService,
    private certificates: CertificateService,
  ) {}

  private async checkCourseAccess(userId: string, courseId: string | null) {
    if (!courseId) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'ADMIN') return;
    const purchase = await this.prisma.purchase.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (purchase?.status !== 'COMPLETED') {
      throw new ForbiddenException('Debes comprar el curso para acceder al test');
    }
  }

  private async getProgress(userId: string, examId: string) {
    const [passedAttempt, lastAttempt, certificate] = await Promise.all([
      this.prisma.examAttempt.findFirst({
        where: { userId, examId, passed: true },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.examAttempt.findFirst({
        where: { userId, examId },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.certificate.findUnique({
        where: { userId_examId: { userId, examId } },
        include: {
          exam: { select: { title: true, courseId: true } },
        },
      }),
    ]);

    const passed = !!passedAttempt;
    const canTakeExam = !passed && !certificate;

    return {
      canTakeExam,
      passed,
      lastAttempt: lastAttempt
        ? {
            id: lastAttempt.id,
            score: lastAttempt.score,
            passed: lastAttempt.passed,
            submittedAt: lastAttempt.submittedAt,
          }
        : null,
      certificate: certificate
        ? {
            id: certificate.id,
            certificateCode: certificate.certificateCode,
            issuedAt: certificate.issuedAt,
            exam: certificate.exam,
          }
        : null,
    };
  }

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    let exams;
    if (user?.role === 'ADMIN') {
      exams = await this.prisma.exam.findMany({
        where: { published: true },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { select: { id: true, text: true } } },
          },
        },
      });
    } else {
      const purchases = await this.prisma.purchase.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { courseId: true },
      });
      const purchasedCourseIds = purchases.map((p) => p.courseId);

      const all = await this.prisma.exam.findMany({
        where: { published: true },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { select: { id: true, text: true } } },
          },
        },
      });

      exams = all.filter((e) => !e.courseId || purchasedCourseIds.includes(e.courseId));
    }

    return Promise.all(
      exams.map(async (exam) => {
        const progress = await this.getProgress(userId, exam.id);
        if (progress.passed && !progress.certificate) {
          const issued = await this.certificates.issue(userId, exam.id);
          progress.certificate = {
            id: issued!.id,
            certificateCode: issued!.certificateCode,
            issuedAt: issued!.issuedAt,
            exam: issued!.exam,
          };
          progress.canTakeExam = false;
        }

        return {
          id: exam.id,
          courseId: exam.courseId,
          title: exam.title,
          passingScore: exam.passingScore,
          published: exam.published,
          ...progress,
          questions: progress.canTakeExam ? exam.questions : [],
        };
      }),
    );
  }

  async getStatus(examId: string, userId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || !exam.published) throw new NotFoundException('Examen no encontrado');

    await this.checkCourseAccess(userId, exam.courseId);

    const progress = await this.getProgress(userId, examId);
    if (progress.passed && !progress.certificate) {
      const issued = await this.certificates.issue(userId, examId);
      progress.certificate = {
        id: issued!.id,
        certificateCode: issued!.certificateCode,
        issuedAt: issued!.issuedAt,
        exam: issued!.exam,
      };
      progress.canTakeExam = false;
    }

    return {
      examId: exam.id,
      title: exam.title,
      courseId: exam.courseId,
      ...progress,
    };
  }

  async submit(examId: string, userId: string, dto: SubmitExamDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { include: { options: true } } },
    });

    if (!exam) throw new NotFoundException('Examen no encontrado');
    if (!exam.published) throw new BadRequestException('Examen no disponible');

    await this.checkCourseAccess(userId, exam.courseId);

    const progress = await this.getProgress(userId, examId);
    if (!progress.canTakeExam) {
      let certificate = progress.certificate;
      if (progress.passed && !certificate) {
        const issued = await this.certificates.issue(userId, examId);
        certificate = {
          id: issued!.id,
          certificateCode: issued!.certificateCode,
          issuedAt: issued!.issuedAt,
          exam: issued!.exam,
        };
      }

      throw new BadRequestException({
        message: 'Ya aprobaste este examen. Tu certificado está disponible para descargar.',
        canTakeExam: false,
        passed: true,
        certificate,
      });
    }

    const total = exam.questions.length;
    if (total === 0) throw new BadRequestException('El examen no tiene preguntas');

    let correct = 0;

    for (const question of exam.questions) {
      const answer = dto.answers.find((a) => a.questionId === question.id);
      if (!answer) continue;
      const selectedOption = question.options.find((o) => o.id === answer.optionId);
      if (selectedOption?.isCorrect) correct++;
    }

    const notaExacta = 1 + (correct / total) * 6;
    const nota = Math.round(notaExacta * 10) / 10;
    const passed = nota >= 5.0;
    const score = Math.round((correct / total) * 100);

    const attempt = await this.prisma.examAttempt.create({
      data: { userId, examId, score, passed },
    });

    const certificate = passed ? await this.certificates.issue(userId, examId) : null;

    return {
      attemptId: attempt.id,
      correctas: correct,
      total,
      score,
      nota,
      notaMaxima: 7,
      notaAprobacion: 5,
      passed,
      canTakeExam: !passed,
      certificate: certificate
        ? {
            id: certificate.id,
            certificateCode: certificate.certificateCode,
            issuedAt: certificate.issuedAt,
            exam: certificate.exam,
          }
        : null,
    };
  }
}
