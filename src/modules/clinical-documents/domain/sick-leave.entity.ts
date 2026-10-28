import {
  AuthorshipMetadata,
  GuardianDetail,
  ModoFirmaDocumento,
} from './clinical-document.repository.interface';

export interface SickLeaveProps {
  idPaciente: number;
  idCita: number;
  pacienteNombre: string;
  pacienteDocumento: string;
  pacienteFechaNacimiento: Date | string;
  pacienteSexo: string | null;
  acudiente?: GuardianDetail | null;
  diasIncapacidad: number;
  motivoIncapacidad: string;
  fechaExpedicion?: Date;
  modoFirma?: ModoFirmaDocumento;
  diligenciadoPor: AuthorshipMetadata;
}

export class SickLeaveEntity {
  public readonly idPaciente: number;
  public readonly idCita: number;
  public readonly pacienteNombre: string;
  public readonly pacienteDocumento: string;
  public readonly pacienteEdad: number;
  public readonly esMenorDeEdad: boolean;
  public readonly pacienteSexo: string;
  public readonly diasIncapacidad: number;
  public readonly motivoIncapacidad: string;
  public readonly fechaInicio: string; // DD/MM/AAAA
  public readonly fechaFin: string;    // DD/MM/AAAA
  public readonly acudiente?: GuardianDetail;
  public readonly requiereFirmaAcudiente: boolean;
  public readonly modoFirma: ModoFirmaDocumento;
  public readonly diligenciadoPor: AuthorshipMetadata;

  private constructor(
    props: SickLeaveProps,
    edad: number,
    fechaInicio: string,
    fechaFin: string
  ) {
    this.idPaciente = props.idPaciente;
    this.idCita = props.idCita;
    this.pacienteNombre = props.pacienteNombre.trim();
    this.pacienteDocumento = props.pacienteDocumento.trim();
    this.pacienteEdad = edad;
    this.esMenorDeEdad = edad < 18;
    this.pacienteSexo = props.pacienteSexo!.trim();
    this.diasIncapacidad = props.diasIncapacidad;
    this.motivoIncapacidad = props.motivoIncapacidad.trim();
    this.fechaInicio = fechaInicio;
    this.fechaFin = fechaFin;
    this.requiereFirmaAcudiente = this.esMenorDeEdad;
    this.acudiente = this.esMenorDeEdad && props.acudiente ? props.acudiente : undefined;
    this.modoFirma = props.modoFirma ?? 'CON_FIRMA_REGISTRADA';
    this.diligenciadoPor = props.diligenciadoPor;
  }

  public static create(props: SickLeaveProps): SickLeaveEntity {
    if (!props.idPaciente || props.idPaciente <= 0) {
      throw new Error('Campo [idPaciente]: El identificador del paciente es obligatorio.');
    }

    if (!props.idCita || props.idCita <= 0) {
      throw new Error('Campo [idCita]: El identificador de la cita es obligatorio.');
    }

    if (
      props.diasIncapacidad === undefined ||
      props.diasIncapacidad === null ||
      !Number.isInteger(Number(props.diasIncapacidad)) ||
      Number(props.diasIncapacidad) < 1 ||
      Number(props.diasIncapacidad) > 30
    ) {
      throw new Error(
        'Campo [diasIncapacidad]: Los días de incapacidad deben ser un entero entre 1 y 30.'
      );
    }

    if (!props.motivoIncapacidad || !props.motivoIncapacidad.trim()) {
      throw new Error('Campo [motivoIncapacidad]: El motivo de la incapacidad es obligatorio.');
    }

    const fechaExpedicion = props.fechaExpedicion ?? new Date();
    const edad = SickLeaveEntity.calcularEdadEnColombia(
      props.pacienteFechaNacimiento,
      fechaExpedicion
    );

    if (!props.pacienteSexo || !props.pacienteSexo.trim()) {
      throw new Error(
        'No se puede generar el documento clínico: el paciente tiene "Datos incompletos".'
      );
    }

    if (edad < 18) {
      const acudienteValido =
        props.acudiente &&
        props.acudiente.nombreCompleto?.trim() &&
        props.acudiente.documentoIdentidad?.trim() &&
        props.acudiente.parentesco?.trim();

      if (!acudienteValido) {
        throw new Error(
          'No se puede generar el documento clínico: el paciente es menor de 18 años y tiene "Datos incompletos" (falta registrar los datos del acudiente).'
        );
      }
    }

    const { fechaInicio, fechaFin } = SickLeaveEntity.calcularRangoFechasIncapacidad(
      fechaExpedicion,
      Number(props.diasIncapacidad)
    );

    return new SickLeaveEntity(
      { ...props, diasIncapacidad: Number(props.diasIncapacidad) },
      edad,
      fechaInicio,
      fechaFin
    );
  }

  /**
   * Calcula la edad cumplida considerando el huso horario de Colombia (UTC-5).
   */
  public static calcularEdadEnColombia(
    fechaNacimientoInput: Date | string,
    fechaReferencia: Date = new Date()
  ): number {
    const nacimiento = new Date(fechaNacimientoInput);
    if (Number.isNaN(nacimiento.getTime())) {
      throw new Error('Campo [fechaNacimiento]: La fecha de nacimiento del paciente no es válida.');
    }

    const hoyColombia = SickLeaveEntity.obtenerPartesFechaColombia(fechaReferencia);
    const nacAno = nacimiento.getUTCFullYear();
    const nacMes = nacimiento.getUTCMonth() + 1;
    const nacDia = nacimiento.getUTCDate();

    let edad = hoyColombia.year - nacAno;
    if (
      hoyColombia.month < nacMes ||
      (hoyColombia.month === nacMes && hoyColombia.day < nacDia)
    ) {
      edad--;
    }
    return edad;
  }

  /**
   * RF-DOC-002: La incapacidad inicia el día de expedición.
   * Ejemplo del criterio de aceptación: Inicio 09/10/2026 con 2 días -> Fin 10/10/2026.
   */
  public static calcularRangoFechasIncapacidad(
    fechaExpedicion: Date,
    diasIncapacidad: number
  ): { fechaInicio: string; fechaFin: string } {
    const partesInicio = SickLeaveEntity.obtenerPartesFechaColombia(fechaExpedicion);
    const baseUtc = new Date(
      Date.UTC(partesInicio.year, partesInicio.month - 1, partesInicio.day)
    );

    const finUtc = new Date(baseUtc.getTime());
    finUtc.setUTCDate(finUtc.getUTCDate() + (diasIncapacidad - 1));

    const fechaInicio = SickLeaveEntity.formatearFechaDDMMAAAA(
      baseUtc.getUTCDate(),
      baseUtc.getUTCMonth() + 1,
      baseUtc.getUTCFullYear()
    );
    const fechaFin = SickLeaveEntity.formatearFechaDDMMAAAA(
      finUtc.getUTCDate(),
      finUtc.getUTCMonth() + 1,
      finUtc.getUTCFullYear()
    );

    return { fechaInicio, fechaFin };
  }

  private static obtenerPartesFechaColombia(fecha: Date): {
    year: number;
    month: number;
    day: number;
  } {
    // Ajuste explícito a America/Bogota (UTC-5)
    const offsetColombiaMs = -5 * 60 * 60 * 1000;
    const fechaColombia = new Date(fecha.getTime() + offsetColombiaMs);
    return {
      year: fechaColombia.getUTCFullYear(),
      month: fechaColombia.getUTCMonth() + 1,
      day: fechaColombia.getUTCDate(),
    };
  }

  private static formatearFechaDDMMAAAA(dia: number, mes: number, ano: number): string {
    const dd = String(dia).padStart(2, '0');
    const mm = String(mes).padStart(2, '0');
    return `${dd}/${mm}/${ano}`;
  }
}