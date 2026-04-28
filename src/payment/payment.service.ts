import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

@Injectable()
export class PaymentService {
  private preference: Preference;
  private payment: Payment;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MP_ACCESS_TOKEN')!,
    });
    this.preference = new Preference(client);
    this.payment = new Payment(client);
  }

  async createCheckoutSession(userId: string, videoId: string) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });

    if (!video) throw new NotFoundException('Video no encontrado');
    if (!video.published) throw new BadRequestException('Este video no está disponible');

    const existingPurchase = await this.prisma.purchase.findUnique({
      where: { userId_videoId: { userId, videoId } },
    });

    if (existingPurchase?.status === 'COMPLETED') {
      throw new ConflictException('Ya compraste este video');
    }

    const result = await this.preference.create({
      body: {
        items: [
          {
            id: video.id,
            title: video.title,
            description: video.description || undefined,
            quantity: 1,
            unit_price: video.priceClp,
            currency_id: 'CLP',
          },
        ],
        back_urls: {
          success: this.configService.get<string>('MP_SUCCESS_URL'),
          failure: this.configService.get<string>('MP_FAILURE_URL'),
          pending: this.configService.get<string>('MP_PENDING_URL'),
        },
        auto_return: 'approved',
        external_reference: `${userId}|${videoId}`,
        notification_url: this.configService.get<string>('MP_WEBHOOK_URL'),
      },
    });

    if (existingPurchase) {
      await this.prisma.purchase.update({
        where: { id: existingPurchase.id },
        data: {
          providerSessionId: result.id!,
          status: 'PENDING',
        },
      });
    } else {
      await this.prisma.purchase.create({
        data: {
          userId,
          videoId,
          provider: 'MERCADOPAGO',
          providerSessionId: result.id!,
          amountClp: video.priceClp,
          status: 'PENDING',
        },
      });
    }

    return {
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    };
  }

  async handleWebhook(body: any) {
    const topic = body?.type || body?.topic;

    if (topic !== 'payment') return { received: true };

    const paymentId = body?.data?.id || body?.id;
    if (!paymentId) return { received: true };

    const paymentData = await this.payment.get({ id: String(paymentId) });

    const externalRef = paymentData.external_reference;
    if (!externalRef) return { received: true };

    const [userId, videoId] = externalRef.split('|');
    if (!userId || !videoId) return { received: true };

    const mpStatus = paymentData.status;

    const purchaseStatus =
      mpStatus === 'approved'
        ? 'COMPLETED'
        : mpStatus === 'pending' || mpStatus === 'in_process'
          ? 'PENDING'
          : 'FAILED';

    await this.prisma.purchase.updateMany({
      where: { userId, videoId },
      data: {
        status: purchaseStatus,
        providerPaymentId: String(paymentId),
      },
    });

    return { received: true };
  }
}
