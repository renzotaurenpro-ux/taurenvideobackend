import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

const EPISODE_SELECT = {
  id: true,
  title: true,
  description: true,
  thumbnailUrl: true,
  duration: true,
  order: true,
} as const;

const COURSE_PUBLIC_SELECT = {
  id: true,
  title: true,
  description: true,
  thumbnailUrl: true,
  priceClp: true,
  published: true,
  videos: {
    where: { published: true },
    orderBy: { order: 'asc' as const },
    select: EPISODE_SELECT,
  },
} as const;

const CACHE_MS = 60_000;
let catalogCache: { at: number; data: Awaited<ReturnType<CourseService['loadCatalog']>> } | null = null;
const watchCache = new Map<string, { at: number; data: unknown }>();

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

  private loadCatalog() {
    return this.prisma.course.findMany({
      where: { published: true },
      select: COURSE_PUBLIC_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAll() {
    const now = Date.now();
    if (catalogCache && now - catalogCache.at < CACHE_MS) return catalogCache.data;
    const data = await this.loadCatalog();
    catalogCache = { at: now, data };
    return data;
  }

  async findOneWithVideos(id: string, includeUrl = false) {
    const now = Date.now();
    if (includeUrl) {
      const hit = watchCache.get(id);
      if (hit && now - hit.at < CACHE_MS) return hit.data;
    }

    const course = await this.prisma.course.findUnique({
      where: { id },
      select: {
        ...COURSE_PUBLIC_SELECT,
        videos: {
          where: { published: true },
          orderBy: { order: 'asc' },
          select: {
            ...EPISODE_SELECT,
            ...(includeUrl ? { url: true, bunnyVideoId: true } : {}),
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (includeUrl) watchCache.set(id, { at: now, data: course });
    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    catalogCache = null;
    watchCache.delete(id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }
}
