import {
  AuthorshipMetadata,
  MedicationDetail,
  ModoFirmaDocumento,
} from './clinical-document.repository.interface';

export interface PrescriptionProps {
  idPaciente: number;
  idCita: number;
  pacienteNombre: string;
  pacienteDocumento: string;
  pacienteEdad: number;
  pacienteSexo: string | null;
  tieneDatosIncompletos: boolean;
  medicamentos: MedicationDetail[];
  indicacionesAdicionales?: string;
  modoFirma?: ModoFirmaDocumento;
  diligenciadoPor: AuthorshipMetadata;
}

export class PrescriptionEntity {
  public readonly idPaciente: number;
  public readonly idCita: number;
  public readonly pacienteNombre: string;
  public readonly pacienteDocumento: string;
  public readonly pacienteEdad: number;
  public readonly pacienteSexo: string;
  public readonly medicamentos: ReadonlyArray<MedicationDetail>;
  public readonly indicacionesAdicionales?: string;
  public readonly modoFirma: ModoFirmaDocumento;
  public readonly diligenciadoPor: AuthorshipMetadata;

  private constructor(props: PrescriptionProps) {
    this.idPaciente = props.idPaciente;
    this.idCita = props.idCita;
    this.pacienteNombre = props.pacienteNombre.trim();
    this.pacienteDocumento = props.pacienteDocumento.trim();
    this.pacienteEdad = props.pacienteEdad;
    this.pacienteSexo = props.pacienteSexo!.trim();
    this.medicamentos = Object.freeze(
      props.medicamentos.map((med) => ({
        nombrePresentacion: med.nombrePresentacion.trim(),
        dosis: med.dosis.trim(),
        frecuencia: med.frecuencia.trim(),
        duracion: med.duracion.trim(),
      }))
    );
    this.indicacionesAdicionales = props.indicacionesAdicionales?.trim() || undefined;
    this.modoFirma = props.modoFirma ?? 'CON_FIRMA_REGISTRADA';
    this.diligenciadoPor = props.diligenciadoPor;
  }

  public static create(props: PrescriptionProps): PrescriptionEntity {
    if (!props.idPaciente || props.idPaciente <= 0) {
      throw new Error('Campo [idPaciente]: El identificador del paciente es obligatorio.');
    }

    if (!props.idCita || props.idCita <= 0) {
      throw new Error('Campo [idCita]: El identificador de la cita es obligatorio.');
    }

    if (props.tieneDatosIncompletos || !props.pacienteSexo || !props.pacienteSexo.trim()) {
      throw new Error(
        'No se puede generar el documento clínico: el paciente tiene "Datos incompletos".'
      );
    }

    if (!Array.isArray(props.medicamentos) || props.medicamentos.length === 0) {
      throw new Error(
        'Campo [medicamentos]: Debe registrar al menos un medicamento en la orden.'
      );
    }

    props.medicamentos.forEach((med, index) => {
      const posicion = index + 1;
      if (!med.nombrePresentacion || !med.nombrePresentacion.trim()) {
        throw new Error(
          `Campo [medicamentos[${posicion}].nombrePresentacion]: El nombre y presentación del medicamento #${posicion} es obligatorio.`
        );
      }
      if (!med.dosis || !med.dosis.trim()) {
        throw new Error(
          `Campo [medicamentos[${posicion}].dosis]: La dosis del medicamento #${posicion} es obligatoria.`
        );
      }
      if (!med.frecuencia || !med.frecuencia.trim()) {
        throw new Error(
          `Campo [medicamentos[${posicion}].frecuencia]: La frecuencia del medicamento #${posicion} es obligatoria.`
        );
      }
      if (!med.duracion || !med.duracion.trim()) {
        throw new Error(
          `Campo [medicamentos[${posicion}].duracion]: La duración del medicamento #${posicion} es obligatoria.`
        );
      }
    });

    if (
      !props.diligenciadoPor ||
      !props.diligenciadoPor.idUsuario ||
      !props.diligenciadoPor.nombreProfesional?.trim()
    ) {
      throw new Error(
        'Campo [diligenciadoPor]: Los datos de autoría del profesional responsable son obligatorios.'
      );
    }

    return new PrescriptionEntity(props);
  }
}