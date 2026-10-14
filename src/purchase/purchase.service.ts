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
    if (cached?.purchased && now - cached.at < ACCESS_CACHE_MS) {
      return { purchased: true };
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
    if (purchased) {
      accessCache.set(key, { at: now, purchased: true });
    } else {
      accessCache.delete(key);
    }
    return { purchased };
  }

  clearAccessCache(firebaseUid: string, courseId: string) {
    accessCache.delete(`${firebaseUid}:${courseId}`);
  }

  clearAccessCacheForUser(firebaseUid: string) {
    const prefix = `${firebaseUid}:`;
    for (const key of accessCache.keys()) {
      if (key.startsWith(prefix)) accessCache.delete(key);
    }
  }

  clearAllAccessCache() {
    accessCache.clear();
  }

  async clearAccessCacheByUserId(userId: string, courseId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firebaseUid: true },
    });
    if (!user) return;
    if (courseId) this.clearAccessCache(user.firebaseUid, courseId);
    else this.clearAccessCacheForUser(user.firebaseUid);
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
