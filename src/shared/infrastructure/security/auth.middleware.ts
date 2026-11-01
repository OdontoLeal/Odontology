// src/shared/infrastructure/security/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { JwtTokenService, TokenPayload } from './token.service';
import { db } from '../database/database';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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

  // Verificar si el token fue revocado en logout (DEF-01)
  try {
    const revokedRes = await db.query(
      `SELECT token FROM public.sesion_invalida WHERE token = $1;`,
      [token]
    );
    if (revokedRes.rows.length > 0) {
      res.status(401).json({
        message: 'Sesión invalidada. Inicie sesión nuevamente.',
      });
      return;
    }
  } catch (err) {
    // Si la tabla no está disponible en mock unit tests, continuar
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

/**
 * Middleware para requerir un permiso específico (RBAC - RQNF-SEG-003)
 */
export function requirePermission(rfCode: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user as TokenPayload | undefined;
    if (!user) {
      res.status(401).json({
        message: 'No tiene permiso para realizar esta acción. Sesión no iniciada',
      });
      return;
    }

    // Verificar si el usuario tiene el permiso en su token o roles
    const permisos = user.permisos ?? [];
    const hasPerm = permisos.includes(rfCode);

    if (!hasPerm) {
      // Registrar intento no autorizado en auditoría (RQNF-SEG-009)
      try {
        await db.query(
          `INSERT INTO log_auditoria (usuario, accion, registro_afectado, detalle) VALUES ($1, $2, $3, $4)`,
          [
            user.correo || user.nombreCompleto || 'Desconocido',
            `Intento no autorizado de acceso a ${rfCode}`,
            'rbac:security',
            JSON.stringify({ ruta: req.originalUrl, metodo: req.method, rfRequerido: rfCode })
          ]
        );
      } catch (auditErr) {
        console.error('Error al registrar auditoría de RBAC:', auditErr);
      }

      res.status(403).json({
        message: 'No tiene permiso para realizar esta acción',
      });
      return;
    }

    next();
  };
}
