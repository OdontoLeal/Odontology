// src/shared/domain/authorship-metadata.vo.ts
import { ColombiaTime } from './colombia-time.util';

/**
 * Regla de Negocio 10: Trazabilidad de autoría inalterable.
 * Cada cita guarda "Agendado por" y cada cambio guarda usuario (o "Sistema"), fecha y hora.
 * Cada registro clínico guarda "Diligenciado por", fecha, hora y profesional responsable.
 */
export interface AuthorshipMetadataProps {
  idUsuario: number | null; // null cuando el autor es "Sistema"
  nombreUsuario: string;    // Nombre completo o "Sistema"
  fecha: Date;
  motivo?: string | null;
  reporte?: string | null;
}

export class AuthorshipMetadataVO {
  public readonly idUsuario: number | null;
  public readonly nombreUsuario: string;
  public readonly fecha: Date;
  public readonly motivo: string | null;
  public readonly reporte: string | null;

  private constructor(props: AuthorshipMetadataProps) {
    this.idUsuario = props.idUsuario;
    this.nombreUsuario = props.nombreUsuario.trim() || 'Sistema';
    this.fecha = new Date(props.fecha.getTime());
    this.motivo = props.motivo ? props.motivo.trim() : null;
    this.reporte = props.reporte ? props.reporte.trim() : null;
  }

  public static create(props: {
    idUsuario?: number | null;
    nombreUsuario?: string;
    fecha?: Date;
    motivo?: string | null;
    reporte?: string | null;
  }): AuthorshipMetadataVO {
    return new AuthorshipMetadataVO({
      idUsuario: props.idUsuario ?? null,
      nombreUsuario: props.nombreUsuario ?? 'Sistema',
      fecha: props.fecha ?? new Date(),
      motivo: props.motivo ?? null,
      reporte: props.reporte ?? null,
    });
  }

  public static system(motivo?: string, reporte?: string): AuthorshipMetadataVO {
    return new AuthorshipMetadataVO({
      idUsuario: null,
      nombreUsuario: 'Sistema',
      fecha: new Date(),
      motivo: motivo ?? null,
      reporte: reporte ?? 'Acción automática del sistema',
    });
  }

  public getFormattedColombiaDate(): string {
    return ColombiaTime.formatDateTime(this.fecha);
  }

  public toJSON() {
    return {
      idUsuario: this.idUsuario,
      nombreUsuario: this.nombreUsuario,
      fecha: this.fecha.toISOString(),
      fechaFormateada: this.getFormattedColombiaDate(),
      motivo: this.motivo,
      reporte: this.reporte,
    };
  }
}
