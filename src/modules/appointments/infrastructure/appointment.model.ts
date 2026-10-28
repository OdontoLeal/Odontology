export type EstadoCita =
  | 'Solicitada'
  | 'Pendiente de confirmación'
  | 'Confirmada'
  | 'Rechazada'
  | 'En consulta'
  | 'En espera'
  | 'Completada'
  | 'Atendida'
  | 'Cancelada'
  | 'No asistió'
  | 'Inasistencia';

export interface TimeSlotRow {
  inicio: string;
  final: string;
  estado: boolean;
  ocupacion: boolean;
}

export interface MonthlyDaySummary {
  fecha: string;
  dia: number;
  totalCitas: number;
  totalBloques: number;
  sinBloques: boolean;
}

export interface CreateSolicitudCitaDTO {
  nombreSolicitante: string;
  documentoSolicitante: string;
  correoSolicitante: string;
  telefonoSolicitante?: string;
  fechaNacimiento?: string;
  sexo?: string;
  bloqueSolicitado: string; 
  descripcion?: string;
  idProfesional?: number;
}

export interface CreateCitaDTO {
  titulo: string;
  descripcion?: string;
  idPaciente: number;
  idUsuarioProfesional: number;
  idUsuarioGestor: number; 
  bloques: string[];       
}