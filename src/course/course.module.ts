import { Module } from '@nestjs/common';
import { CourseService } from './course.service.js';
import { CourseController } from './course.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PurchaseModule } from '../purchase/purchase.module.js';
import { BunnyModule } from '../bunny/bunny.module.js';

@Module({
  imports: [PrismaModule, PurchaseModule, BunnyModule],
  controllers: [CourseController],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}
