import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../../generated/prisma/client.js';

const ACCESS_CACHE_MS = 45_000;
const accessCache = new Map<string, { at: number; purchased: boolean }>();

@Injectable()
export class PurchaseService {
  constructor(private prisma: PrismaService) {}

  async checkCourseAccess(firebaseUid: string, courseId: string) {
    const key = `${firebaseUid}:${courseId}`;
    const now = Date.now();
    const cached = accessCache.get(key);
    if (cached && now - cached.at < ACCESS_CACHE_MS) {
      return { purchased: cached.purchased };
    }

    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        role: true,
        purchases: {
          where: { courseId, status: 'COMPLETED' },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    const purchased = user.role === Role.ADMIN || user.purchases.length > 0;
    accessCache.set(key, { at: now, purchased });
    return { purchased };
  }

  clearAccessCache(firebaseUid: string, courseId: string) {
    accessCache.delete(`${firebaseUid}:${courseId}`);
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
