import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FirebaseService } from '../firebase/firebase.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private firebaseService: FirebaseService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const firebaseUser = await this.firebaseService
      .getAuth()
      .createUser({
        email: dto.email,
        password: dto.password,
        displayName: dto.displayName,
      })
      .catch((err: any) => {
        const code = err?.errorInfo?.code || err?.code;
        if (code === 'auth/configuration-not-found') {
          throw new BadRequestException(
            'Firebase Auth no está configurado en este proyecto. En Firebase Console > Authentication, habilita Email/Password y vuelve a intentar.',
          );
        }
        if (code === 'auth/invalid-credential' || code === 'app/invalid-credential') {
          throw new BadRequestException(
            'Credenciales de Firebase inválidas. Revisa FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en el .env.',
          );
        }
        throw err;
      });

    const user = await this.prisma.user.create({
      data: {
        firebaseUid: firebaseUser.uid,
        email: dto.email,
        displayName: dto.displayName,
        emailVerified: false,
      },
    });

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async login(idToken: string) {
    const decodedToken = await this.firebaseService
      .getAuth()
      .verifyIdToken(idToken)
      .catch(() => {
        throw new UnauthorizedException('Token inválido');
      });

    let user = await this.prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email!,
          displayName: decodedToken.name || null,
          photoUrl: decodedToken.picture || null,
          emailVerified: decodedToken.email_verified || false,
        },
      });
    }

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      emailVerified: user.emailVerified,
      role: user.role,
    };
  }

  async getProfile(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      emailVerified: user.emailVerified,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(firebaseUid: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updated = await this.prisma.user.update({
      where: { firebaseUid },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
      },
    });

    if (dto.displayName !== undefined) {
      await this.firebaseService
        .getAuth()
        .updateUser(firebaseUid, { displayName: dto.displayName });
    }

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      photoUrl: updated.photoUrl,
      role: updated.role,
    };
  }

  async deleteAccount(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.prisma.user.delete({ where: { firebaseUid } });
    await this.firebaseService.getAuth().deleteUser(firebaseUid);

    return { message: 'Cuenta eliminada correctamente' };
  }
}
