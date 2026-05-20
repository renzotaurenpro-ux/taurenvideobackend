import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CourseService } from './course.service.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('courses')
@Controller('courses')
export class CourseController {
  constructor(
    private courseService: CourseService,
    private prisma: PrismaService,
  ) {}

  @Get()
  findAll() {
    return this.courseService.findAll();
  }

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Get(':id/watch')
  async watchCourse(@Param('id') id: string, @Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: req.user.uid },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.role === Role.ADMIN) {
      return this.courseService.findOneWithVideos(id, true);
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: id } },
    });
    if (purchase?.status !== 'COMPLETED') {
      throw new ForbiddenException('Debes comprar el curso para acceder a los videos');
    }

    return this.courseService.findOneWithVideos(id, true);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Put('admin/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.courseService.update(id, dto);
  }
}
