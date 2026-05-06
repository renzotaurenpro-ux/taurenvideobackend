import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitExamDto } from './dto/submit-exam.dto.js';

@Injectable()
export class ExamService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.role === 'ADMIN') {
      return this.prisma.exam.findMany({
        where: { published: true },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: {
              options: { select: { id: true, text: true } },
            },
          },
        },
      });
    }

    const purchases = await this.prisma.purchase.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { videoId: true },
    });

    const purchasedVideoIds = purchases.map((p) => p.videoId);

    return this.prisma.exam.findMany({
      where: { published: true },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: { select: { id: true, text: true } },
          },
        },
      },
    }).then((exams) =>
      exams.filter((e) => !e.videoId || purchasedVideoIds.includes(e.videoId)),
    );
  }

  async findOne(id: string, userId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: { select: { id: true, text: true } },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Examen no encontrado');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.role !== 'ADMIN' && exam.videoId) {
      const purchase = await this.prisma.purchase.findUnique({
        where: { userId_videoId: { userId, videoId: exam.videoId } },
      });
      if (purchase?.status !== 'COMPLETED') {
        throw new ForbiddenException('Debes comprar el video para acceder al test');
      }
    }

    return exam;
  }

  async findAllAdmin() {
    return this.prisma.exam.findMany({
      include: { questions: { include: { options: true } } },
    });
  }

  async submit(examId: string, userId: string, dto: SubmitExamDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { include: { options: true } } },
    });

    if (!exam) throw new NotFoundException('Examen no encontrado');
    if (!exam.published) throw new BadRequestException('Examen no disponible');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.role !== 'ADMIN' && exam.videoId) {
      const purchase = await this.prisma.purchase.findUnique({
        where: { userId_videoId: { userId, videoId: exam.videoId } },
      });
      if (purchase?.status !== 'COMPLETED') {
        throw new ForbiddenException('Debes comprar el video para acceder al test');
      }
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

  async remove(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException('Examen no encontrado');
    await this.prisma.exam.delete({ where: { id } });
    return { message: 'Examen eliminado' };
  }
}
