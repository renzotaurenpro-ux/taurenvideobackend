import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VideoService } from './video.service.js';
import { UpdateVideoDto } from './dto/update-video.dto.js';
import { PrepareUploadDto } from './dto/prepare-upload.dto.js';
import { RegisterVideoDto } from './dto/register-video.dto.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('videos-admin')
@Controller('videos/admin')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class VideoController {
  constructor(private videoService: VideoService) {}

  @Get('all')
  findAllAdmin() {
    return this.videoService.findAllAdmin();
  }

  @Post('prepare-upload')
  prepareUpload(@Body() dto: PrepareUploadDto) {
    return this.videoService.prepareUpload(dto);
  }

  @Post('register')
  registerVideo(@Body() dto: RegisterVideoDto) {
    return this.videoService.registerVideo(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVideoDto) {
    return this.videoService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.videoService.remove(id);
  }
}
