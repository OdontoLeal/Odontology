// src/modules/users-auth/infrastructure/draft-storage.service.ts
import { db } from '../../../shared/infrastructure/database/database';
import {
  IDraftStorageService,
  SessionDraftDTO,
} from '../domain/user.repository.interface';

/**
 * RF-USR-008: borradores de cambios sin guardar al cerrar la sesión por
 * inactividad. Se guardan en `borrador_sesion` (antes vivían en memoria y se
 * perdían al reiniciar el servidor). Solo los ve su propio usuario.
 */
export class DraftStorageService implements IDraftStorageService {
  public async saveDraft(draft: SessionDraftDTO): Promise<void> {
    await db.query(
      `INSERT INTO public.borrador_sesion (id_usuario, formulario_id, datos, fecha_guardado)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (id_usuario, formulario_id)
       DO UPDATE SET datos = EXCLUDED.datos, fecha_guardado = EXCLUDED.fecha_guardado;`,
      [draft.idUsuario, draft.formularioId, JSON.stringify(draft.datosBorrador ?? {}), draft.fechaGuardado]
    );
  }

  public async getDraftByUser(idUsuario: number): Promise<SessionDraftDTO[]> {
    const { rows } = await db.query<{
      id_usuario: number;
      formulario_id: string;
      datos: Record<string, unknown>;
      fecha_guardado: string | Date;
    }>(
      `SELECT id_usuario, formulario_id, datos, fecha_guardado
         FROM public.borrador_sesion
        WHERE id_usuario = $1
        ORDER BY fecha_guardado DESC;`,
      [idUsuario]
    );
    return rows.map((r) => ({
      idUsuario: r.id_usuario,
      formularioId: r.formulario_id,
      datosBorrador: r.datos ?? {},
      fechaGuardado: new Date(r.fecha_guardado),
    }));
  }

  public async deleteDraft(idUsuario: number, formularioId: string): Promise<void> {
    await db.query(
      `DELETE FROM public.borrador_sesion WHERE id_usuario = $1 AND formulario_id = $2;`,
      [idUsuario, formularioId]
    );
  }
}
