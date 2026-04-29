import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PurchaseService {
  constructor(private prisma: PrismaService) {}

  async getUserPurchases(userId: string) {
    return this.prisma.purchase.findMany({
      where: { userId, status: 'COMPLETED' },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            description: true,
            url: true,
            thumbnailUrl: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async hasUserPurchasedVideo(userId: string, videoId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { userId_videoId: { userId, videoId } },
    });

    return { purchased: purchase?.status === 'COMPLETED' };
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
        video: {
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
