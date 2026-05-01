import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { VideoService } from './video.service.js';
import { CreateVideoDto } from './dto/create-video.dto.js';
import { UpdateVideoDto } from './dto/update-video.dto.js';
import { PrepareUploadDto } from './dto/prepare-upload.dto.js';
import { RegisterVideoDto } from './dto/register-video.dto.js';
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
  @Post('admin/prepare-upload')
  prepareUpload(@Body() dto: PrepareUploadDto) {
    return this.videoService.prepareUpload(dto);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/register')
  registerVideo(@Body() dto: RegisterVideoDto) {
    return this.videoService.registerVideo(dto);
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
