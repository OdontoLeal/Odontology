import {
  AuthorshipMetadata,
  ModoFirmaDocumento,
} from './clinical-document.repository.interface';

export const ESPECIALIDADES_REMISION_CATALOGO = [
  'Endodoncia',
  'Cirugía oral',
  'Ortopedia maxilar',
  'Periodoncia',
  'Otra',
] as const;

export type EspecialidadCatalogo = (typeof ESPECIALIDADES_REMISION_CATALOGO)[number];

export interface ReferralProps {
  idPaciente: number;
  idCita: number;
  pacienteNombre: string;
  pacienteDocumento: string;
  pacienteEdad: number;
  pacienteSexo: string | null;
  tieneDatosIncompletos: boolean;
  especialidadSeleccionada: string;
  otraEspecialidad?: string;
  motivoRemision: string;
  modoFirma?: ModoFirmaDocumento;
  diligenciadoPor: AuthorshipMetadata;
}

export class ReferralEntity {
  public readonly idPaciente: number;
  public readonly idCita: number;
  public readonly pacienteNombre: string;
  public readonly pacienteDocumento: string;
  public readonly pacienteEdad: number;
  public readonly pacienteSexo: string;
  public readonly especialidadDestino: string;
  public readonly motivoRemision: string;
  public readonly modoFirma: ModoFirmaDocumento;
  public readonly diligenciadoPor: AuthorshipMetadata;

  private constructor(props: ReferralProps, especialidadResuelta: string) {
    this.idPaciente = props.idPaciente;
    this.idCita = props.idCita;
    this.pacienteNombre = props.pacienteNombre.trim();
    this.pacienteDocumento = props.pacienteDocumento.trim();
    this.pacienteEdad = props.pacienteEdad;
    this.pacienteSexo = props.pacienteSexo!.trim();
    this.especialidadDestino = especialidadResuelta;
    this.motivoRemision = props.motivoRemision.trim();
    this.modoFirma = props.modoFirma ?? 'CON_FIRMA_REGISTRADA';
    this.diligenciadoPor = props.diligenciadoPor;
  }

  public static create(props: ReferralProps): ReferralEntity {
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

    if (!props.especialidadSeleccionada || !props.especialidadSeleccionada.trim()) {
      throw new Error(
        'Campo [especialidadDestino]: La especialidad a la que se remite es obligatoria.'
      );
    }

    const seleccionNormalizada = props.especialidadSeleccionada.trim();
    let especialidadFinal = seleccionNormalizada;

    if (seleccionNormalizada.toLowerCase() === 'otra') {
      if (!props.otraEspecialidad || !props.otraEspecialidad.trim()) {
        throw new Error(
          'Campo [otraEspecialidad]: Debe escribir el nombre de la especialidad cuando selecciona "Otra".'
        );
      }
      especialidadFinal = props.otraEspecialidad.trim();
    }

    if (!props.motivoRemision || !props.motivoRemision.trim()) {
      throw new Error('Campo [motivoRemision]: El motivo de la remisión es obligatorio.');
    }

    return new ReferralEntity(props, especialidadFinal);
  }
}