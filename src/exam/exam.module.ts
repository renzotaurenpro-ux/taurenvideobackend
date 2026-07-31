import { Module } from '@nestjs/common';
import { ExamController } from './exam.controller.js';
import { ExamService } from './exam.service.js';
import { CertificateModule } from '../certificate/certificate.module.js';

@Module({
  imports: [CertificateModule],
  controllers: [ExamController],
  providers: [ExamService],
})
export class ExamModule {}
