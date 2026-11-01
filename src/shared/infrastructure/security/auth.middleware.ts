// src/shared/infrastructure/security/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { JwtTokenService, TokenPayload } from './token.service';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      token = parts[1];
    } else {
      res.status(401).json({
        message: 'Formato de autorización no válido. Debe ser Bearer <token>',
      });
      return;
    }
  }

  // 2. Extraer token de cookie si no viene en encabezado
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split('=');
      if (name === 'session_token' || name === 'token') {
        token = decodeURIComponent(val);
        break;
      }
    }
  }

  if (!token) {
    res.status(401).json({
      message: 'No tiene permiso para realizar esta acción. Sesión no iniciada',
    });
    return;
  }

  const payload = JwtTokenService.verifyToken(token);
  if (!payload) {
    res.status(401).json({
      message: 'Token de autenticación inválido o expirado.',
    });
    return;
  }

  (req as any).user = payload;
  next();
}
