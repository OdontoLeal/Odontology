import { handleHttpError } from '../../../shared/infrastructure/http/http-error.handler';
import { Request, Response } from 'express';
import { CreatePatientUseCase } from '../application/create-patient.use-case';
import { ExportHolderDataUseCase } from '../application/export-holder-data.use-case';
import { GetPatientProfileUseCase } from '../application/get-patient-profile.use-case';
import { SearchPatientsUseCase } from '../application/search-patients.use-case';
import { UpdatePatientUseCase } from '../application/update-patient.use-case';
import { IPatientRepository } from '../domain/patient.repository.interface';

export class PatientsController {
  private readonly createPatientUseCase: CreatePatientUseCase;
  private readonly updatePatientUseCase: UpdatePatientUseCase;
  private readonly searchPatientsUseCase: SearchPatientsUseCase;
  private readonly getPatientProfileUseCase: GetPatientProfileUseCase;
  private readonly exportHolderDataUseCase: ExportHolderDataUseCase;

  constructor(
    patientRepo: IPatientRepository,
    useCases?: {
      createPatientUseCase?: CreatePatientUseCase;
      updatePatientUseCase?: UpdatePatientUseCase;
      searchPatientsUseCase?: SearchPatientsUseCase;
      getPatientProfileUseCase?: GetPatientProfileUseCase;
      exportHolderDataUseCase?: ExportHolderDataUseCase;
    }
  ) {
    this.createPatientUseCase =
      useCases?.createPatientUseCase ?? new CreatePatientUseCase(patientRepo);
    this.updatePatientUseCase =
      useCases?.updatePatientUseCase ?? new UpdatePatientUseCase(patientRepo);
    this.searchPatientsUseCase =
      useCases?.searchPatientsUseCase ?? new SearchPatientsUseCase(patientRepo);
    this.getPatientProfileUseCase =
      useCases?.getPatientProfileUseCase ??
      new GetPatientProfileUseCase(patientRepo);
    this.exportHolderDataUseCase =
      useCases?.exportHolderDataUseCase ??
      new ExportHolderDataUseCase(patientRepo);
  }

  // RF-HCL-001: Crear paciente
  public createPatient = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        fechaNacimiento,
        sexo,
        contactoRespaldo,
        acudiente,
        autorizacionDatos,
        creadoDesdeSolicitud,
      } = req.body;

      const user = (req as any).user;

      // I3-007 (RQNF-SEG-005, RF-HCL-001, D-16):
      // Si se suministra autorizacionDatos pero no viene idUsuarioRegistro, inyectar el usuario de la sesión autenticada.
      // Conforme al DDL actual, si no se envía autorización explícita, proveer autorización por defecto para no bloquear la creación.
      let processedAuth = autorizacionDatos;
      if (processedAuth && typeof processedAuth === 'object') {
        processedAuth = {
          ...processedAuth,
          idUsuarioRegistro:
            processedAuth.idUsuarioRegistro !== undefined
              ? processedAuth.idUsuarioRegistro
              : (user?.idUsuario ?? null),
        };
      } else if (!processedAuth) {
        processedAuth = {
          autorizado: true,
          medio: 'CONSULTORIO_WEB',
          versionAvisoPrivacidad: 'v1.1',
          idUsuarioRegistro: user?.idUsuario ?? null,
        };
      }

      const result = await this.createPatientUseCase.execute({
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        fechaNacimiento,
        sexo,
        contactoRespaldo,
        acudiente,
        autorizacionDatos: processedAuth,
        creadoDesdeSolicitud,
      });

      res.status(201).json({
        message: 'Paciente creado con historial clínico vacío.',
        data: {
          ...result.patient,
          historiaClinicaBase: result.historiaClinicaBase,
        },
      });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  // RF-HCL-002: Editar paciente
  public updatePatient = async (req: Request, res: Response): Promise<void> => {
    try {
      const idPaciente = Number(req.params.id);
      const user = (req as any).user;

      const updated = await this.updatePatientUseCase.execute({
        idPaciente,
        idUsuarioActor: user?.idUsuario,
        changes: req.body,
      });

      res.json({
        message: 'Datos del paciente actualizados.',
        data: updated,
      });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  // RF-HCL-003: Buscar pacientes
  public searchPatients = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const q = req.query.q
        ? String(req.query.q)
        : req.query.search
        ? String(req.query.search)
        : undefined;
      const result = await this.searchPatientsUseCase.execute(q);

      res.status(200).json({
        data: result.data || [],
        message: result.message,
      });
    } catch (error: any) {
      this.handleError(res, error, 500);
    }
  };

  // RF-HCL-004: Visualizar ficha de paciente
  public getPatientProfile = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const idPaciente = Number(req.params.id);
      const user = (req as any).user;

      const profile = await this.getPatientProfileUseCase.execute({
        idPaciente,
        requesterRoles: user?.roles ?? [],
        hasActiveConsultationWithPatient: Boolean(
          user?.activeConsultationPatientId === idPaciente
        ),
      });

      res.json({ data: profile });
    } catch (error: any) {
      this.handleError(res, error, 500);
    }
  };

  // RF-HCL-010: Consultar y exportar datos personales del titular (Ley 1581 de 2012)
  public exportHolderData = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const documentoIdentidad = String(
        req.params.documento ?? req.query.documento ?? ''
      );
      const formato =
        String(req.query.formato ?? 'JSON').toUpperCase() === 'PDF'
          ? 'PDF'
          : 'JSON';
      const user = (req as any).user;

      const result = await this.exportHolderDataUseCase.execute({
        documentoIdentidad,
        requesterRoles: user?.roles ?? ['ROL-COA'],
        formato,
      });

      res.json({ data: result });
    } catch (error: any) {
      this.handleError(res, error);
    }
  };

  private handleError(
    res: Response,
    error: any,
    defaultStatus: number = 400
  ): void {
    handleHttpError(res, error, defaultStatus);
  }
}
