import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseService } from './purchase.service.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('purchases')
@Controller('purchases')
export class PurchaseController {
  constructor(
    private purchaseService: PurchaseService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Get('check/course/:courseId')
  async checkCoursePurchase(@Req() req: any, @Param('courseId') courseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: req.user.uid },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.purchaseService.hasUserAccessToCourse(user.id, courseId);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('admin/all')
  getAllPurchases() {
    return this.purchaseService.getAllPurchases();
  }
}
