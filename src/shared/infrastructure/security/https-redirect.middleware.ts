// src/shared/infrastructure/security/https-redirect.middleware.ts
import { NextFunction, Request, Response } from 'express';
import { envConfig } from '../../../app/config/env.config';

export interface EnforceHttpsOptions {
  enabled?: boolean;
}

/**
 * Middleware para forzar HTTPS (RQNF-SEG-001).
 *
 * - Verifica si la petición entrante es insegura (HTTP).
 * - En plataformas PaaS / Proxy Inverso (Heroku, AWS ALB, Nginx),
 *   aprovecha la configuración 'trust proxy' para evaluar req.secure
 *   o la cabecera 'x-forwarded-proto'.
 * - Redirige permanentemente a HTTPS preservando la ruta y parámetros de búsqueda.
 * - Utiliza 301 para métodos seguros (GET, HEAD) y 308 para métodos
 *   con mutación (POST, PUT, PATCH, DELETE) preservando el cuerpo y verbo HTTP original (RFC 7538).
 * - En desarrollo local (localhost / 127.0.0.1) o cuando no esté habilitado,
 *   permite el paso sin redirigir para no bloquear la experiencia de desarrollo.
 */
export function createEnforceHttpsMiddleware(options: EnforceHttpsOptions = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const isEnabled = options.enabled ?? envConfig.security.forceHttps;

    // Si no está habilitado (p. ej. entorno de desarrollo local), continuar
    if (!isEnabled) {
      return next();
    }

    const rawHost = req.get('host') || req.hostname || '';
    const hostname = rawHost.split(':')[0];

    // Salvaguarda para desarrollo local explícito aunque forceHttps esté activo por error
    if (
      (hostname === 'localhost' || hostname === '127.0.0.1') &&
      options.enabled === undefined &&
      process.env.NODE_ENV !== 'production'
    ) {
      return next();
    }

    // Comprobar si la petición ya es segura (req.secure o x-forwarded-proto de proxy)
    const isSecure =
      req.secure ||
      req.protocol === 'https' ||
      req.headers['x-forwarded-proto'] === 'https';

    if (isSecure) {
      return next();
    }

    // Petición insegura: Redirigir a HTTPS
    const targetHost = req.get('host') || req.hostname;
    const targetUrl = `https://${targetHost}${req.originalUrl || req.url}`;

    // 301 para lectura (GET, HEAD), 308 para mutaciones (preserva verbo y payload según RFC 7538)
    const statusCode = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308;

    res.redirect(statusCode, targetUrl);
  };
}

export const enforceHttpsMiddleware = createEnforceHttpsMiddleware();
