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
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('MP_ACCESS_TOKEN no está configurado');
    }
    const client = new MercadoPagoConfig({ accessToken });
    this.preference = new Preference(client);
    this.payment = new Payment(client);
  }

  async createCheckoutSession(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });

    if (!course) throw new NotFoundException('Curso no encontrado');
    if (!course.published) throw new BadRequestException('Este curso no está disponible');

    const existingPurchase = await this.prisma.purchase.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (existingPurchase?.status === 'COMPLETED') {
      throw new ConflictException('Ya compraste este curso');
    }

    const successUrl = this.configService.get<string>('MP_SUCCESS_URL');
    const failureUrl = this.configService.get<string>('MP_FAILURE_URL');
    const pendingUrl = this.configService.get<string>('MP_PENDING_URL');
    const webhookUrl = this.configService.get<string>('MP_WEBHOOK_URL');

    if (!successUrl) throw new BadRequestException('MP_SUCCESS_URL no está configurado');
    if (!failureUrl) throw new BadRequestException('MP_FAILURE_URL no está configurado');
    if (!pendingUrl) throw new BadRequestException('MP_PENDING_URL no está configurado');
    if (!webhookUrl) throw new BadRequestException('MP_WEBHOOK_URL no está configurado');

    const result = await this.preference.create({
      body: {
        items: [
          {
            id: course.id,
            title: course.title,
            description: course.description || undefined,
            quantity: 1,
            unit_price: course.priceClp,
            currency_id: 'CLP',
          },
        ],
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        auto_return: 'approved',
        external_reference: `${userId}|${courseId}`,
        notification_url: webhookUrl,
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
          courseId,
          provider: 'MERCADOPAGO',
          providerSessionId: result.id!,
          amountClp: course.priceClp,
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

    const [userId, courseId] = externalRef.split('|');
    if (!userId || !courseId) return { received: true };

    const mpStatus = paymentData.status;

    const purchaseStatus =
      mpStatus === 'approved'
        ? 'COMPLETED'
        : mpStatus === 'pending' || mpStatus === 'in_process'
          ? 'PENDING'
          : 'FAILED';

    await this.prisma.purchase.updateMany({
      where: { userId, courseId },
      data: {
        status: purchaseStatus,
        providerPaymentId: String(paymentId),
      },
    });

    return { received: true };
  }
}
