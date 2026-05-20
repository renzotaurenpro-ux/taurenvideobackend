import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.course.findMany({
      where: { published: true },
      include: {
        videos: {
          where: { published: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            duration: true,
            order: true,
          },
        },
        _count: { select: { videos: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOneWithVideos(id: string, includeUrl = false) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        videos: {
          where: { published: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            duration: true,
            order: true,
            ...(includeUrl ? { url: true, bunnyVideoId: true } : {}),
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return this.prisma.course.update({ where: { id }, data: dto });
  }
}
