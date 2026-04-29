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
        displayName: `${dto.firstName} ${dto.lastName}`.trim(),
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
        firstName: dto.firstName,
        lastName: dto.lastName,
        rut: dto.rut ?? null,
        workplace: dto.workplace,
        medicalArea: dto.medicalArea,
        phoneNumber: dto.phoneNumber,
        city: dto.city,
        emailVerified: false,
      },
    });

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      rut: user.rut,
      workplace: user.workplace,
      medicalArea: user.medicalArea,
      phoneNumber: user.phoneNumber,
      city: user.city,
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
      const fullName = (decodedToken.name || '').trim();
      const parts = fullName ? fullName.split(/\s+/) : [];
      const firstName = parts[0] ?? '';
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';

      user = await this.prisma.user.create({
        data: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email!,
          firstName,
          lastName,
          workplace: '',
          medicalArea: '',
          phoneNumber: '',
          city: '',
          photoUrl: decodedToken.picture || null,
          emailVerified: decodedToken.email_verified || false,
        },
      });
    }

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      rut: user.rut,
      workplace: user.workplace,
      medicalArea: user.medicalArea,
      phoneNumber: user.phoneNumber,
      city: user.city,
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
      firstName: user.firstName,
      lastName: user.lastName,
      rut: user.rut,
      workplace: user.workplace,
      medicalArea: user.medicalArea,
      phoneNumber: user.phoneNumber,
      city: user.city,
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
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.rut !== undefined && { rut: dto.rut }),
        ...(dto.workplace !== undefined && { workplace: dto.workplace }),
        ...(dto.medicalArea !== undefined && { medicalArea: dto.medicalArea }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
      },
    });

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const nextFirst = dto.firstName ?? updated.firstName;
      const nextLast = dto.lastName ?? updated.lastName;
      await this.firebaseService
        .getAuth()
        .updateUser(firebaseUid, { displayName: `${nextFirst} ${nextLast}`.trim() });
    }

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      rut: updated.rut,
      workplace: updated.workplace,
      medicalArea: updated.medicalArea,
      phoneNumber: updated.phoneNumber,
      city: updated.city,
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
