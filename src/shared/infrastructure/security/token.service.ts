// src/shared/infrastructure/security/token.service.ts
import crypto from 'crypto';

export interface TokenPayload {
  idUsuario: number;
  correo: string;
  nombreCompleto: string;
  roles: string[];
  permisos?: string[];
  iat: number;
  exp: number;
}

export class JwtTokenService {
  private static get secret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;
    // RQNF-SEG-002: la llave no puede vivir en el código en producción.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET no está configurado.');
    }
    return 'odontoleal-jwt-signing-secret-solo-desarrollo';
  }

  public static generateToken(
    payload: Omit<TokenPayload, 'iat' | 'exp'>,
    expiresInHours: number = 8
  ): string {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + expiresInHours * 3600;
    const fullPayload: TokenPayload = { ...payload, iat, exp };

    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' })
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  public static verifyToken(token: string): TokenPayload | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return null;
    }

    try {
      const payload: TokenPayload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8')
      );
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }
}
