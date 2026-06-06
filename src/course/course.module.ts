import { Module } from '@nestjs/common';
import { CourseService } from './course.service.js';
import { CourseController } from './course.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PurchaseModule } from '../purchase/purchase.module.js';

@Module({
  imports: [PrismaModule, PurchaseModule],
  controllers: [CourseController],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}
