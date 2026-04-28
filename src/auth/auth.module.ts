import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthGuard, RolesGuard],
  exports: [AuthService, FirebaseAuthGuard, RolesGuard],
})
export class AuthModule {}
