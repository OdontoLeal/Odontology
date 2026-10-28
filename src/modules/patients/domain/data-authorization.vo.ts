export type AuthorizationMedium =
  | 'CONSULTORIO_WEB'
  | 'SECCION_PUBLICA'
  | 'TABLET_CONSULTORIO';

export interface DataAuthorizationProps {
  autorizado: boolean;
  fechaHora?: Date | string;
  medio: AuthorizationMedium;
  versionAvisoPrivacidad: string;
  idUsuarioRegistro?: number | null;
  firmadoPorAcudiente?: boolean;
}

export class DataAuthorizationVO {
  public readonly autorizado: boolean;
  public readonly fechaHora: Date;
  public readonly medio: AuthorizationMedium;
  public readonly versionAvisoPrivacidad: string;
  public readonly idUsuarioRegistro: number | null;
  public readonly firmadoPorAcudiente: boolean;

  private constructor(props: {
    autorizado: boolean;
    fechaHora: Date;
    medio: AuthorizationMedium;
    versionAvisoPrivacidad: string;
    idUsuarioRegistro: number | null;
    firmadoPorAcudiente: boolean;
  }) {
    this.autorizado = props.autorizado;
    this.fechaHora = props.fechaHora;
    this.medio = props.medio;
    this.versionAvisoPrivacidad = props.versionAvisoPrivacidad;
    this.idUsuarioRegistro = props.idUsuarioRegistro;
    this.firmadoPorAcudiente = props.firmadoPorAcudiente;
    Object.freeze(this);
  }

  public static create(props: DataAuthorizationProps): DataAuthorizationVO {
    if (!props.autorizado) {
      throw new Error(
        'Campo [autorizacionDatos]: Debe aceptar la autorización previa, expresa e informada para el tratamiento de datos personales (Ley 1581 de 2012).'
      );
    }

    if (!props.versionAvisoPrivacidad || !props.versionAvisoPrivacidad.trim()) {
      throw new Error(
        'Campo [versionAvisoPrivacidad]: La versión del aviso de privacidad es obligatoria.'
      );
    }

    const parsedDate =
      props.fechaHora instanceof Date
        ? props.fechaHora
        : props.fechaHora
        ? new Date(props.fechaHora)
        : new Date();

    if (isNaN(parsedDate.getTime())) {
      throw new Error(
        'Campo [fechaHora]: La fecha y hora de la autorización de datos no es válida.'
      );
    }

    return new DataAuthorizationVO({
      autorizado: true,
      fechaHora: parsedDate,
      medio: props.medio,
      versionAvisoPrivacidad: props.versionAvisoPrivacidad.trim(),
      idUsuarioRegistro: props.idUsuarioRegistro ?? null,
      firmadoPorAcudiente: Boolean(props.firmadoPorAcudiente),
    });
  }

  public toPrimitives() {
    return {
      autorizado: this.autorizado,
      fechaHora: this.fechaHora.toISOString(),
      medio: this.medio,
      versionAvisoPrivacidad: this.versionAvisoPrivacidad,
      idUsuarioRegistro: this.idUsuarioRegistro,
      firmadoPorAcudiente: this.firmadoPorAcudiente,
    };
  }
}