import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { VideoService } from './video.service.js';
import { CreateVideoDto } from './dto/create-video.dto.js';
import { UpdateVideoDto } from './dto/update-video.dto.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';

@Controller('videos')
export class VideoController {
  constructor(private videoService: VideoService) {}

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  findAllAdmin() {
    return this.videoService.findAllAdmin();
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/upload')
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage() }))
  async uploadVideoParts(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('title') title: string,
    @Query('priceClp') priceClp: string,
    @Query('description') description?: string,
    @Query('published') published?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Se requiere al menos un archivo de video');
    }
    if (!title) throw new BadRequestException('El campo title es requerido');
    if (!priceClp) throw new BadRequestException('El campo priceClp es requerido');

    return this.videoService.uploadVideoParts(
      files,
      title,
      description,
      parseInt(priceClp, 10),
      published === 'true',
    );
  }

  @Get()
  findAll() {
    return this.videoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videoService.findOne(id);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateVideoDto) {
    return this.videoService.create(dto);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVideoDto) {
    return this.videoService.update(id, dto);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videoService.remove(id);
  }
}
