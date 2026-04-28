import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from './payment.service.js';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('payment')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(FirebaseAuthGuard)
  @Post('checkout')
  async createCheckout(@Req() req: any, @Body('videoId') videoId: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: req.user.uid },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.paymentService.createCheckoutSession(user.id, videoId);
  }

  @Post('webhook')
  async webhook(@Body() body: any) {
    return this.paymentService.handleWebhook(body);
  }
}
