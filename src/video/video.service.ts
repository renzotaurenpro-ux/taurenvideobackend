import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BunnyService } from '../bunny/bunny.service.js';
import { CreateVideoDto } from './dto/create-video.dto.js';
import { UpdateVideoDto } from './dto/update-video.dto.js';
import { PrepareUploadDto } from './dto/prepare-upload.dto.js';
import { RegisterVideoDto } from './dto/register-video.dto.js';

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private bunny: BunnyService,
  ) {}

  async prepareUpload(dto: PrepareUploadDto) {
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
        priceClp: dto.priceClp,
        published: dto.published ?? false,
      },
    };
  }

  async registerVideo(dto: RegisterVideoDto) {
    return this.prisma.video.create({
      data: {
        title: dto.title,
        description: dto.description,
        url: `https://iframe.mediadelivery.net/embed/${this.bunny['libraryId']}/${dto.bunnyVideoId}`,
        bunnyVideoId: dto.bunnyVideoId,
        priceClp: dto.priceClp,
        published: dto.published ?? false,
      },
    });
  }

  async create(dto: CreateVideoDto) {
    return this.prisma.video.create({ data: dto });
  }

  async findAll() {
    return this.prisma.video.findMany({
      where: { published: true },
      orderBy: { order: 'asc' },
    });
  }

  async findAllAdmin() {
    return this.prisma.video.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video no encontrado');
    return video;
  }

  async update(id: string, dto: UpdateVideoDto) {
    await this.findOne(id);
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
