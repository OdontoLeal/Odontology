// src/shared/infrastructure/http/http-error.handler.ts
import { Response } from 'express';

/**
 * Manejador centralizado de errores HTTP (Clean Code & D-07)
 * - Evita fuga de datos internos de PostgreSQL (constraints, hostnames, sintaxis SQL).
 * - Mapea violaciones de unicidad a mensajes de negocio limpios con 400.
 * - Mapea fallas de base de datos e infraestructura a código 500 sin exponer detalles técnicos.
 */
export function handleHttpError(
  res: Response,
  error: any,
  defaultStatus: number = 400
): void {
  // 1. Errores de dominio con código HTTP explícito
  if (error && typeof error.statusCode === 'number') {
    res.status(error.statusCode).json({
      field: error.field,
      message: error.message,
    });
    return;
  }

  if (error && typeof error.status === 'number') {
    res.status(error.status).json({
      message: error.message,
    });
    return;
  }

  const message = String(error?.message || '');

  // 2. Errores de base de datos o fallas de infraestructura
  const isPostgresOrInfra =
    Boolean(error?.code && typeof error.code === 'string' && error.code.length === 5) ||
    Boolean(error?.routine) ||
    /ENOTFOUND|ECONNREFUSED|getaddrinfo|violates|syntax error|relation .* does not exist|column .* does not exist/i.test(
      message
    );

  if (isPostgresOrInfra) {
    if (error?.code === '23505' || /duplicate key|unique constraint/i.test(message)) {
      res.status(400).json({
        message: 'Ya existe un registro con el documento o valor único proporcionado.',
      });
      return;
    }
    if (error?.code === '22001' || /value too long/i.test(message)) {
      res.status(400).json({
        message: 'Uno o más campos superan la longitud máxima permitida.',
      });
      return;
    }

    // Falla de red, conexión a PostgreSQL o error no controlado -> 500 seguro
    res.status(500).json({
      message: 'Error interno en el servidor. Por favor intente más tarde.',
    });
    return;
  }

  // 3. Errores de aplicación / validación estándar
  res.status(defaultStatus).json({
    message: message || 'Error interno procesando la solicitud.',
  });
}
