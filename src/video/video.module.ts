import { Module } from '@nestjs/common';
import { VideoController } from './video.controller.js';
import { VideoService } from './video.service.js';
import { BunnyModule } from '../bunny/bunny.module.js';

@Module({
  imports: [BunnyModule],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
