import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { CreateVideoDto } from './dto/create-video.dto.js';
import { UpdateVideoDto } from './dto/update-video.dto.js';

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateVideoDto) {
    return this.prisma.video.create({ data: dto });
  }

  async uploadVideoParts(
    files: Express.Multer.File[],
    title: string,
    description: string | undefined,
    priceClp: number,
    published: boolean,
  ) {
    const results: Awaited<ReturnType<typeof this.prisma.video.create>>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const partTitle = `${title} - Parte ${i + 1}`;
      const folder = `tauren/${title.replace(/\s+/g, '_')}`;

      const uploaded = await this.cloudinary.uploadVideo(file.buffer, folder);

      const video = await this.prisma.video.create({
        data: {
          title: partTitle,
          description,
          url: uploaded.secure_url,
          cloudinaryPublicId: uploaded.public_id,
          priceClp,
          duration: Math.round(uploaded.duration ?? 0),
          order: i + 1,
          published,
        },
      });

      results.push(video);
    }

    return results;
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
    if (video.cloudinaryPublicId) {
      await this.cloudinary.deleteVideo(video.cloudinaryPublicId);
    }
    await this.prisma.video.delete({ where: { id } });
    return { message: 'Video eliminado correctamente' };
  }
}
