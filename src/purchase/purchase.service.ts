import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PurchaseService {
  constructor(private prisma: PrismaService) {}

  async hasUserPurchasedCourse(userId: string, courseId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    return { purchased: purchase?.status === 'COMPLETED' };
  }

  async hasUserAccessToCourse(userId: string, courseId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'ADMIN') return { purchased: true };
    return this.hasUserPurchasedCourse(userId, courseId);
  }

  async getAllPurchases() {
    return this.prisma.purchase.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            rut: true,
            workplace: true,
            medicalArea: true,
            phoneNumber: true,
            city: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            priceClp: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
