import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitExamDto } from './dto/submit-exam.dto.js';

@Injectable()
export class ExamService {
  constructor(private prisma: PrismaService) {}

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

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.role === 'ADMIN') {
      return this.prisma.exam.findMany({
        where: { published: true },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { select: { id: true, text: true } } },
          },
        },
      });
    }

    const purchases = await this.prisma.purchase.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { courseId: true },
    });

    const purchasedCourseIds = purchases.map((p) => p.courseId);

    const exams = await this.prisma.exam.findMany({
      where: { published: true },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { select: { id: true, text: true } } },
        },
      },
    });

    return exams.filter((e) => !e.courseId || purchasedCourseIds.includes(e.courseId));
  }

  async submit(examId: string, userId: string, dto: SubmitExamDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { include: { options: true } } },
    });

    if (!exam) throw new NotFoundException('Examen no encontrado');
    if (!exam.published) throw new BadRequestException('Examen no disponible');

    await this.checkCourseAccess(userId, exam.courseId);

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

    return {
      attemptId: attempt.id,
      correctas: correct,
      total,
      nota,
      notaMaxima: 7,
      notaAprobacion: 5,
      passed,
    };
  }
}
