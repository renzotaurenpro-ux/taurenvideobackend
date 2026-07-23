import { Module } from '@nestjs/common';
import { VideoController } from './video.controller.js';
import { VideoService } from './video.service.js';
import { BunnyModule } from '../bunny/bunny.module.js';
import { CourseModule } from '../course/course.module.js';

@Module({
  imports: [BunnyModule, CourseModule],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
