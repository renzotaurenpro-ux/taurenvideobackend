import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service.js';

const CACHE_MS = 5 * 60_000;
const CACHE_MAX = 300;
const tokenCache = new Map<string, { at: number; user: Record<string, unknown> }>();

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private firebaseService: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const token = authHeader.slice(7);
    const now = Date.now();
    const cached = tokenCache.get(token);
    if (cached && now - cached.at < CACHE_MS) {
      request.user = cached.user;
      return true;
    }

    try {
      const decodedToken = await this.firebaseService
        .getAuth()
        .verifyIdToken(token, false);
      tokenCache.set(token, { at: now, user: decodedToken });
      if (tokenCache.size > CACHE_MAX) {
        const oldest = tokenCache.keys().next().value;
        if (oldest) tokenCache.delete(oldest);
      }
      request.user = decodedToken;
      return true;
    } catch {
      tokenCache.delete(token);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
