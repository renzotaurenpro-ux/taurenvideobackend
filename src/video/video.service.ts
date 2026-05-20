import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BunnyService } from '../bunny/bunny.service.js';
import { UpdateVideoDto } from './dto/update-video.dto.js';
import { PrepareUploadDto } from './dto/prepare-upload.dto.js';
import { RegisterVideoDto } from './dto/register-video.dto.js';

const MAX_EPISODES_PER_COURSE = 22;

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private bunny: BunnyService,
  ) {}

  private async assertCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }

  private async assertEpisodeLimit(courseId: string) {
    const count = await this.prisma.video.count({ where: { courseId } });
    if (count >= MAX_EPISODES_PER_COURSE) {
      throw new BadRequestException(
        `El curso ya tiene el máximo de ${MAX_EPISODES_PER_COURSE} episodios`,
      );
    }
    return count;
  }

  private async resolveOrder(courseId: string, order?: number) {
    if (order !== undefined && order !== null) return order;
    const count = await this.prisma.video.count({ where: { courseId } });
    return count + 1;
  }

  async prepareUpload(dto: PrepareUploadDto) {
    await this.assertCourse(dto.courseId);
    const episodeCount = await this.assertEpisodeLimit(dto.courseId);
    const order = dto.order ?? episodeCount + 1;
    const { videoId, embedUrl } = await this.bunny.createVideoSlot(dto.title);
    const upload = this.bunny.generateUploadHeaders(videoId);

    return {
      videoId,
      embedUrl,
      uploadUrl: upload.uploadUrl,
      uploadHeaders: upload.headers,
      metadata: {
        title: dto.title,
        description: dto.description,
        courseId: dto.courseId,
        order,
        published: dto.published ?? false,
      },
    };
  }

  async registerVideo(dto: RegisterVideoDto) {
    await this.assertCourse(dto.courseId);
    await this.assertEpisodeLimit(dto.courseId);
    const order = await this.resolveOrder(dto.courseId, dto.order);
    return this.prisma.video.create({
      data: {
        title: dto.title,
        description: dto.description,
        url: `https://iframe.mediadelivery.net/embed/${this.bunny['libraryId']}/${dto.bunnyVideoId}`,
        bunnyVideoId: dto.bunnyVideoId,
        courseId: dto.courseId,
        order,
        published: dto.published ?? false,
      },
    });
  }

  async findAllAdmin() {
    return this.prisma.video.findMany({
      include: { course: { select: { id: true, title: true } } },
      orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
    });
  }

  async findOne(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: { course: { select: { id: true, title: true } } },
    });
    if (!video) throw new NotFoundException('Video no encontrado');
    return video;
  }

  async update(id: string, dto: UpdateVideoDto) {
    const video = await this.findOne(id);
    if (dto.courseId && dto.courseId !== video.courseId) {
      await this.assertCourse(dto.courseId);
      await this.assertEpisodeLimit(dto.courseId);
    }
    return this.prisma.video.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const video = await this.findOne(id);
    if (video.bunnyVideoId) {
      await this.bunny.deleteVideo(video.bunnyVideoId);
    }
    await this.prisma.video.delete({ where: { id } });
    return { message: 'Video eliminado correctamente' };
  }
}
