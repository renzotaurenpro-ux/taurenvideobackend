import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseService } from './purchase.service.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('purchases')
export class PurchaseController {
  constructor(
    private purchaseService: PurchaseService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(FirebaseAuthGuard)
  @Get('my')
  async getMyPurchases(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: req.user.uid },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.purchaseService.getUserPurchases(user.id);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('check/:videoId')
  async checkPurchase(@Req() req: any, @Param('videoId') videoId: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: req.user.uid },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role === Role.ADMIN) {
      return { purchased: true };
    }

    return this.purchaseService.hasUserPurchasedVideo(user.id, videoId);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  getAllPurchases() {
    return this.purchaseService.getAllPurchases();
  }
}
