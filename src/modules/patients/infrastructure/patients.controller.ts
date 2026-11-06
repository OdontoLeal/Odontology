import { Request, Response } from 'express';
import { handleHttpError } from '../../../shared/infrastructure/http/http-error.handler';
import { auditLog } from '../../../shared/infrastructure/audit/audit-log.service';
import { getSessionUser } from '../../../shared/infrastructure/security/access-control';
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

  // RF-HCL-001: Crear paciente (ERS v1.3: sin acudiente ni autorización en la ficha)
  public createPatient = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const { nombreCompleto, documentoIdentidad, correo, telefono, fechaNacimiento, sexo } = req.body ?? {};

      const result = await this.createPatientUseCase.execute({
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        fechaNacimiento,
        sexo,
        actor: { idUsuario: user.idUsuario, actor: user.correo },
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
      const user = getSessionUser(req)!;
      const updated = await this.updatePatientUseCase.execute({
        idPaciente: Number(req.params.id),
        idUsuarioActor: user.idUsuario,
        actor: user.correo,
        changes: req.body ?? {},
      });

      res.json({ message: 'Datos del paciente actualizados.', data: updated });
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
      const profile = await this.getPatientProfileUseCase.execute({
        idPaciente: Number(req.params.id),
        requesterRoles: getSessionUser(req)?.roles ?? [],
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
      const user = getSessionUser(req)!;

      const result = await this.exportHolderDataUseCase.execute({
        documentoIdentidad,
        requesterRoles: user.roles,
        formato,
      });

      // RQNF-SEG-009: toda consulta de titulares queda registrada.
      await auditLog.record({
        idUsuario: user.idUsuario,
        actor: user.correo,
        accion: 'CONSULTA_TITULAR',
        entidad: 'titular',
        idRegistro: documentoIdentidad,
        detalle: { formato },
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
