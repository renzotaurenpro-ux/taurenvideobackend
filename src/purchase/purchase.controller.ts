import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseService } from './purchase.service.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';

@ApiTags('purchases')
@Controller('purchases')
export class PurchaseController {
  constructor(private purchaseService: PurchaseService) {}

  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @Get('check/course/:courseId')
  checkCoursePurchase(@Req() req: any, @Param('courseId') courseId: string) {
    return this.purchaseService.checkCourseAccess(req.user.uid, courseId);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('admin/all')
  getAllPurchases() {
    return this.purchaseService.getAllPurchases();
  }
}
