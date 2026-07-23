import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BunnyService } from '../bunny/bunny.service.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

const EPISODE_PUBLIC = {
  id: true,
  title: true,
  description: true,
  thumbnailUrl: true,
  duration: true,
  order: true,
} as const;

const EPISODE_WATCH = {
  ...EPISODE_PUBLIC,
  bunnyVideoId: true,
} as const;

const CACHE_MS = 60_000;
let catalogCache: { at: number; data: unknown } | null = null;
const watchCache = new Map<string, { at: number; data: unknown }>();

@Injectable()
export class CourseService {
  constructor(
    private prisma: PrismaService,
    private bunny: BunnyService,
  ) {}

  clearCaches(courseId?: string) {
    catalogCache = null;
    if (courseId) watchCache.delete(courseId);
    else watchCache.clear();
  }

  async findAll() {
    const now = Date.now();
    if (catalogCache && now - catalogCache.at < CACHE_MS) return catalogCache.data;

    const data = await this.prisma.course.findMany({
      where: { published: true },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        priceClp: true,
        published: true,
        videos: {
          where: { published: true },
          orderBy: { order: 'asc' },
          select: EPISODE_PUBLIC,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    catalogCache = { at: now, data };
    return data;
  }

  async findOneWithVideos(id: string) {
    const now = Date.now();
    const hit = watchCache.get(id);
    if (hit && now - hit.at < CACHE_MS) return hit.data;

    const course = await this.prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        priceClp: true,
        published: true,
        videos: {
          where: { published: true },
          orderBy: { order: 'asc' },
          select: EPISODE_WATCH,
        },
      },
    });

    if (!course) throw new NotFoundException('Curso no encontrado');

    const data = {
      ...course,
      videos: course.videos.map(({ bunnyVideoId, thumbnailUrl, ...episode }) => ({
        ...episode,
        thumbnailUrl: thumbnailUrl || (bunnyVideoId ? this.bunny.getThumbnailUrl(bunnyVideoId) : null),
        url: bunnyVideoId ? this.bunny.getEmbedUrl(bunnyVideoId) : null,
      })),
    };

    watchCache.set(id, { at: now, data });
    return data;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    this.clearCaches(id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }
}
