import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { FirebaseModule } from './firebase/firebase.module.js';
import { AuthModule } from './auth/auth.module.js';
import { VideoModule } from './video/video.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { PurchaseModule } from './purchase/purchase.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    FirebaseModule,
    AuthModule,
    VideoModule,
    PaymentModule,
    PurchaseModule,
  ],
})
export class AppModule {}
